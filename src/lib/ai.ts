import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// --- Provider config ---
const primaryProvider = process.env.LLM_PROVIDER || "openai";
const secondaryProvider = primaryProvider === "openai" ? "gemini" : "openai";

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
  options?: { lite?: boolean; jsonMode?: boolean; forceProvider?: "openai" | "gemini" }
): Promise<string> {
  const model = options?.lite ? chatModel : evalModel;
  // jsonMode fuerza al API a devolver JSON válido (response_format). Elimina la
  // clase de fallo "el modelo devolvió prosa/markdown y JSON.parse revienta",
  // que era la causa probable de las evals perdidas (no rate-limit).
  const jsonMode = options?.jsonMode ?? false;

  // Orden de proveedores: forceProvider (si viene) primero, luego el otro como
  // failover. Sin forceProvider = comportamiento normal (primario → secundario).
  // Se usa forceProvider en el reintento del chat de paciente: si el primario
  // devolvió VACÍO, reintentar el mismo modelo probablemente repita el vacío,
  // así que forzamos el secundario para de verdad usar el fallback.
  const firstProvider = options?.forceProvider ?? primaryProvider;
  const order = firstProvider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
  const call = (prov: string) =>
    prov === "openai"
      ? () => chatOpenAI(messages, systemPrompt, model, jsonMode)
      : () => chatGemini(messages, systemPrompt, jsonMode);

  let lastErr: unknown;
  for (let i = 0; i < order.length; i++) {
    const prov = order[i];
    try {
      return await withRetry(call(prov));
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i < order.length - 1) {
        console.warn(`[ai] Provider "${prov}" failed (${msg}); failing over to "${order[i + 1]}".`);
      } else {
        console.error(`[ai] All providers failed (last: ${prov} — ${msg}).`);
      }
    }
  }
  throw lastErr;
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
  systemPrompt?: string,
  jsonMode?: boolean
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
    config: {
      systemInstruction: systemPrompt,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  const text = response.text || "";
  // Una completación vacía no lanza excepción por sí sola; la convertimos en
  // error para que el failover de chat() pase al otro proveedor.
  if (!text.trim()) throw new Error("empty_completion (gemini)");
  return text;
}

async function chatOpenAI(
  messages: ChatMessage[],
  systemPrompt?: string,
  model?: string,
  jsonMode?: boolean
): Promise<string> {
  const allMessages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) allMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) allMessages.push({ role: m.role, content: m.content });

  const response = await getOpenAI().chat.completions.create({
    model: model || evalModel,
    messages: allMessages,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });

  const text = response.choices[0]?.message?.content || "";
  // Vacío = error, para disparar el failover al otro proveedor. finish_reason
  // distingue glitch (stop/length) de filtro de contenido (content_filter).
  if (!text.trim()) {
    const reason = response.choices[0]?.finish_reason ?? "unknown";
    throw new Error(`empty_completion (openai, finish_reason=${reason})`);
  }
  return text;
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

        let emittedAny = false;
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) { emittedAny = true; controller.enqueue(text); }
        }
        clearTimeout(timeout);
        if (!emittedAny) {
          controller.error(new Error("empty_stream (gemini)"));
          return;
        }
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

        let emittedAny = false;
        let finishReason: string | null = null;
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
          if (text) { emittedAny = true; controller.enqueue(text); }
        }
        clearTimeout(timeout);
        // Completación vacía: NO lanza excepción por sí sola, así que el failover
        // de chatStream nunca se enteraría. La convertimos en error — solo si no
        // emitimos NADA, para no duplicar texto ya enviado río abajo — para que
        // caiga al proveedor secundario. finish_reason distingue glitch
        // (stop/length) de filtro de contenido (content_filter).
        if (!emittedAny) {
          controller.error(new Error(`empty_stream (openai, finish_reason=${finishReason ?? "unknown"})`));
          return;
        }
        controller.close();
      } catch (err) {
        clearTimeout(timeout);
        controller.error(err);
      }
    },
  });
}

export { primaryProvider as currentProvider, secondaryProvider, chatModel, evalModel };
