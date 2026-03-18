import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// --- Provider config ---
const provider = process.env.LLM_PROVIDER || "openai";

// --- Model config ---
// CHAT_MODEL: used for patient conversations (fast, cheap)
// EVAL_MODEL: used for evaluations and analysis (precise)
const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
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

// --- Timeout for LLM calls (90 seconds) ---
const LLM_TIMEOUT_MS = 90_000;

// --- Unified chat interface ---
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Non-streaming chat — uses EVAL model (gpt-4o) by default.
 * Used for: evaluations, profile generation, ficha clínica, tutor feedback.
 */
export async function chat(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  if (provider === "openai") {
    return chatOpenAI(messages, systemPrompt, evalModel);
  }
  return chatGemini(messages, systemPrompt);
}

/**
 * Streaming chat — uses CHAT model (gpt-4o-mini) for patient conversations.
 * Used for: real-time patient responses in the chat interface.
 */
export function chatStream(
  messages: ChatMessage[],
  systemPrompt?: string
): ReadableStream<string> {
  if (provider === "openai") {
    return chatStreamOpenAI(messages, systemPrompt, chatModel);
  }
  return chatStreamGemini(messages, systemPrompt);
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

export { provider as currentProvider, chatModel, evalModel };
