import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// --- Provider config ---
const primaryProvider = process.env.LLM_PROVIDER || "openai";

// --- Model config ---
// CHAT_MODEL: used for patient conversations (fast, cheap)
// EVAL_MODEL: used for evaluations and analysis (precise)
const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const evalModel = process.env.OPENAI_EVAL_MODEL || process.env.OPENAI_MODEL || "gpt-4o";

// --- Lazy singleton initialization ---
let _gemini: GoogleGenAI | null = null;
function getGemini() {
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  return _gemini;
}
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

// --- Timeout & retry config ---
const LLM_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || err.status === 500 || err.status === 503;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("rate") || msg.includes("overloaded") || msg.includes("503") || msg.includes("429");
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Unified chat interface ---
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Non-streaming chat — uses EVAL model (gpt-4o) by default.
 * Used for: evaluations, profile generation, ficha clínica, tutor feedback.
 * Includes retry with backoff + automatic failover to secondary provider.
 */
export async function chat(
  messages: ChatMessage[],
  systemPrompt?: string,
  options?: { lite?: boolean }
): Promise<string> {
  const model = options?.lite ? chatModel : evalModel;

  // Try primary provider with retries
  const primary = primaryProvider === "openai"
    ? () => chatOpenAI(messages, systemPrompt, model)
    : () => chatGemini(messages, systemPrompt);

  try {
    return await withRetry(primary);
  } catch (primaryErr) {
    console.warn(`[ai] Primary provider (${primaryProvider}) failed, attempting failover:`, primaryErr instanceof Error ? primaryErr.message : primaryErr);

    // Failover to secondary provider
    const secondary = primaryProvider === "openai"
      ? () => chatGemini(messages, systemPrompt)
      : () => chatOpenAI(messages, systemPrompt, model);

    try {
      return await secondary();
    } catch (secondaryErr) {
      console.error(`[ai] Failover also failed:`, secondaryErr instanceof Error ? secondaryErr.message : secondaryErr);
      throw primaryErr; // throw original error
    }
  }
}

/**
 * Streaming chat — uses CHAT model (gpt-4o-mini) for patient conversations.
 * Used for: real-time patient responses in the chat interface.
 * Includes automatic failover to secondary provider on error.
 */
export function chatStream(
  messages: ChatMessage[],
  systemPrompt?: string
): ReadableStream<string> {
  const primary = primaryProvider === "openai"
    ? () => chatStreamOpenAI(messages, systemPrompt, chatModel)
    : () => chatStreamGemini(messages, systemPrompt);

  const secondary = primaryProvider === "openai"
    ? () => chatStreamGemini(messages, systemPrompt)
    : () => chatStreamOpenAI(messages, systemPrompt, chatModel);

  return new ReadableStream({
    async start(controller) {
      try {
        await pipeStream(primary(), controller);
      } catch (err) {
        console.warn(`[ai] Streaming primary (${primaryProvider}) failed, attempting failover:`, err instanceof Error ? err.message : err);
        try {
          await pipeStream(secondary(), controller);
        } catch (fallbackErr) {
          console.error(`[ai] Streaming failover also failed:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
          controller.error(err);
        }
      }
    },
  });
}

/** Pipe a ReadableStream into a controller, resolving on close or rejecting on error */
async function pipeStream(
  stream: ReadableStream<string>,
  controller: ReadableStreamDefaultController<string>
): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/** Retry wrapper with exponential backoff */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(`[ai] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay}ms:`, err instanceof Error ? err.message : err);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

// --- Non-streaming ---

async function chatGemini(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    contents.push({ role: "user" as const, parts: [{ text: "Hola" }] });
  }

  const response = await getGemini().models.generateContent({
    model: geminiModel,
    contents,
    config: { systemInstruction: systemPrompt },
  });

  return response.text || "";
}

async function chatOpenAI(
  messages: ChatMessage[],
  systemPrompt?: string,
  model?: string
): Promise<string> {
  const allMessages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) allMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) allMessages.push({ role: m.role, content: m.content });

  const response = await getOpenAI().chat.completions.create({
    model: model || evalModel,
    messages: allMessages,
  });

  return response.choices[0]?.message?.content || "";
}

// --- Streaming (with timeout) ---

function chatStreamGemini(
  messages: ChatMessage[],
  systemPrompt?: string
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      const timeout = setTimeout(() => {
        controller.error(new Error("LLM timeout"));
      }, LLM_TIMEOUT_MS);

      try {
        const contents = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: m.content }],
          }));

        if (contents.length === 0) {
          contents.push({ role: "user" as const, parts: [{ text: "Hola" }] });
        }

        const stream = await getGemini().models.generateContentStream({
          model: geminiModel,
          contents,
          config: { systemInstruction: systemPrompt },
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) controller.enqueue(text);
        }
        clearTimeout(timeout);
        controller.close();
      } catch (err) {
        clearTimeout(timeout);
        controller.error(err);
      }
    },
  });
}

function chatStreamOpenAI(
  messages: ChatMessage[],
  systemPrompt?: string,
  model?: string
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      const timeout = setTimeout(() => {
        controller.error(new Error("LLM timeout"));
      }, LLM_TIMEOUT_MS);

      try {
        const allMessages: OpenAI.ChatCompletionMessageParam[] = [];
        if (systemPrompt) allMessages.push({ role: "system", content: systemPrompt });
        for (const m of messages) allMessages.push({ role: m.role, content: m.content });

        const stream = await getOpenAI().chat.completions.create({
          model: model || chatModel,
          messages: allMessages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(text);
        }
        clearTimeout(timeout);
        controller.close();
      } catch (err) {
        clearTimeout(timeout);
        controller.error(err);
      }
    },
  });
}

export { primaryProvider as currentProvider, chatModel, evalModel };
