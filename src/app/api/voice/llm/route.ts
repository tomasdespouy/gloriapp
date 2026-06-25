import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatStream, type ChatMessage } from "@/lib/ai";
import {
  classifyIntervention, calculateDeltas, applyDeltas,
  buildStatePrompt, INITIAL_STATE, type ClinicalState,
} from "@/lib/clinical-state-engine";
import { buildEnrichedPrompt } from "@/lib/build-system-prompt";
import { buildSafetyPrompt } from "@/lib/content-safety";
import { searchVectorRAG, buildVectorRAGContext } from "@/lib/vector-rag";
import { searchKnowledge, buildRAGContext } from "@/lib/clinical-knowledge";

// ─────────────────────────────────────────────────────────────────────────
// CUSTOM LLM endpoint for the ElevenLabs voice agent.
//
// ElevenLabs calls this as an OpenAI-compatible /chat/completions endpoint.
// We ignore the system prompt it sends and rebuild our OWN using the SAME
// adaptive engine as the text chat (/api/chat): clinical-state motor +
// enriched prompt + RAG + safety. ElevenLabs is just ear+mouth+turn-taking;
// the brain is here. Result: the voice patient == the text patient.
//
// Identity (patientId/conversationId/userId) arrives via custom_llm_extra_body
// (top-level fields in the request body). Auth is a shared Bearer secret
// configured on the agent. DB access uses the service-role (admin) client
// because there is no browser cookie — the secret is what we trust.
// ─────────────────────────────────────────────────────────────────────────

export const maxDuration = 120;

// Fallback for the prototype: [QA] Sandbox — Carlos (staging).
const SANDBOX_PATIENT_ID = "16d8d543-dd2d-4ae2-b8f9-5947e8af0b88";

// The voice agent's data lives in STAGING, but this endpoint may be deployed
// on the prod Vercel project (whose default env points to prod). So when
// VOICE_SUPABASE_* are set, talk to that DB explicitly. Locally these are
// unset and we fall back to the default admin client (.env.local → staging).
function voiceAdmin() {
  const url = process.env.VOICE_SUPABASE_URL;
  const key = process.env.VOICE_SUPABASE_SERVICE_KEY;
  if (url && key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return createAdminClient();
}

const THERAPIST_CONTEXT = `\n\n[REGLA CRÍTICA DE ROLES]
Tú eres el/la PACIENTE que viene a terapia. Quien te habla es el/la TERAPEUTA.
- Hablas de TUS problemas, TUS emociones, TU vida.
- NO ofrezcas apoyo ni contención, NO hagas preguntas terapéuticas, NO actúes como profesional.
- Para dirigirte al terapeuta: si te dijo su nombre, úsalo; si no lo sabes, trátalo de "usted". PROHIBIDO decirle "doctor" o "doctora" (no es médico/a, es psicólogo/a); nunca asumas su género.
- Mantén coherencia con todo lo que ya dijiste (edad, familia, datos). Nunca te contradigas.\n`;

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

function sseChunk(content: string, id: string, model: string): string {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function sseDone(id: string, model: string): string {
  const stop = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  return `data: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`;
}

export async function POST(req: NextRequest) {
  // 1. Auth: shared secret between ElevenLabs and us.
  const secret = process.env.VOICE_LLM_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse OpenAI-style body + our extra fields (custom_llm_extra_body).
  let body: {
    messages?: OpenAIMessage[];
    model?: string;
    patientId?: string;
    conversationId?: string;
    userId?: string;
    custom_llm_extra_body?: {
      patientId?: string;
      conversationId?: string;
      userId?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // ── TEMP DEBUG (modo voz): registra la FORMA del body que manda ElevenLabs
  // para confirmar si la identidad llega PLANA (body.conversationId) o ANIDADA
  // (body.custom_llm_extra_body.conversationId). QUITAR tras verificar.
  const extra = body.custom_llm_extra_body ?? {};
  console.log("[voice/llm][DEBUG] body keys:", Object.keys(body));
  console.log("[voice/llm][DEBUG] identidad plana:", {
    patientId: body.patientId ?? null,
    conversationId: body.conversationId ?? null,
    userId: body.userId ?? null,
  });
  console.log("[voice/llm][DEBUG] custom_llm_extra_body:", body.custom_llm_extra_body ?? "(ausente)");

  const model = body.model || "gpt-4o";
  // Lee la identidad en AMBAS formas (plana o anidada) para no depender de
  // cómo ElevenLabs serialice el extra body. Tras confirmar la forma real con
  // el log de arriba, se puede simplificar a una sola.
  const patientId = body.patientId || extra.patientId || SANDBOX_PATIENT_ID;
  const conversationId = body.conversationId || extra.conversationId || null;
  const userId = body.userId || extra.userId || null;
  console.log("[voice/llm][DEBUG] identidad resuelta:", { patientId, conversationId, userId });
  const id = `chatcmpl-voice-${Math.random().toString(36).slice(2)}`;

  // 3. History from ElevenLabs (drop its system prompt — we build our own).
  const incoming = (body.messages || []).filter((m) => m.role !== "system");
  const history: ChatMessage[] = incoming.map((m) => ({ role: m.role, content: m.content }));
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content || "";

  const admin = voiceAdmin();

  // 4. Fetch patient (enrichment fields included so buildEnrichedPrompt works).
  const { data: patient } = await admin
    .from("ai_patients")
    .select("id, name, system_prompt, enrichment_red_social, enrichment_lugares, enrichment_estado_corporal, enrichment_frases_tipo")
    .eq("id", patientId)
    .single();

  if (!patient) {
    return new Response(JSON.stringify({
      error: "Patient not found",
      debug: {
        dedicated: !!(process.env.VOICE_SUPABASE_URL && process.env.VOICE_SUPABASE_SERVICE_KEY),
        hasUrl: !!process.env.VOICE_SUPABASE_URL,
        hasKey: !!process.env.VOICE_SUPABASE_SERVICE_KEY,
        dbHost: (process.env.VOICE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "?").replace("https://", "").slice(0, 24),
        patientId,
      },
    }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // 5. MOTOR ADAPTATIVO: load last state → classify → update.
  let currentState: ClinicalState = INITIAL_STATE;
  let turnNumber = 1;
  if (conversationId) {
    const { data: dbState } = await admin
      .from("clinical_state_log")
      .select("resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio, turn_number")
      .eq("conversation_id", conversationId)
      .order("turn_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dbState) {
      currentState = {
        resistencia: Number(dbState.resistencia),
        alianza: Number(dbState.alianza),
        apertura_emocional: Number(dbState.apertura_emocional),
        sintomatologia: Number(dbState.sintomatologia),
        disposicion_cambio: Number(dbState.disposicion_cambio),
      };
      turnNumber = (dbState.turn_number || 0) + 1;
    }
  }

  const interventionType = classifyIntervention(lastUser);
  const deltas = calculateDeltas(interventionType, currentState);
  const newState = applyDeltas(currentState, deltas);
  const statePrompt = buildStatePrompt(newState);

  // 6. RAG (vector first, keyword fallback) — same as text chat.
  const recentContext = history.slice(-4).map((m) => m.content).join(" ");
  let ragContext = "";
  try {
    const vec = await searchVectorRAG(recentContext, 3, 0.4);
    ragContext = vec.length > 0 ? buildVectorRAGContext(vec) : buildRAGContext(searchKnowledge(recentContext));
  } catch {
    ragContext = "";
  }

  // 7. Compose the SAME-style system prompt as /api/chat.
  const safety = buildSafetyPrompt();
  const basePrompt = buildEnrichedPrompt(patient);
  const systemPrompt =
    safety + basePrompt + THERAPIST_CONTEXT + statePrompt + ragContext +
    "\n\n[REGLA ANTI-REPETICIÓN]\nNUNCA repitas textualmente una respuesta que ya diste.\n" +
    safety;

  // 8. Stream the LLM response back in OpenAI SSE format; persist on close.
  const encoder = new TextEncoder();
  const chunks: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = chatStream(history, systemPrompt).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            controller.enqueue(encoder.encode(sseChunk(value, id, model)));
          }
        }
      } catch {
        // fall through — emit whatever we have + close cleanly
      }

      const fullResponse = chunks.join("").trim();

      // Persist (best-effort) the new user turn + the assistant reply +
      // the clinical state, so the transcript and feedback motor get fed
      // exactly like the text chat. Only if we have a conversationId.
      if (conversationId && fullResponse) {
        try {
          const rows = [];
          if (lastUser) rows.push({ conversation_id: conversationId, role: "user", content: lastUser });
          rows.push({ conversation_id: conversationId, role: "assistant", content: fullResponse });
          await admin.from("messages").insert(rows);
          await admin.from("clinical_state_log").insert({
            conversation_id: conversationId,
            turn_number: turnNumber,
            intervention_type: interventionType,
            intervention_raw: lastUser.slice(0, 1000),
            ...newState,
            delta_resistencia: deltas.resistencia || 0,
            delta_alianza: deltas.alianza || 0,
            delta_apertura: deltas.apertura_emocional || 0,
            delta_sintomatologia: deltas.sintomatologia || 0,
            delta_disposicion: deltas.disposicion_cambio || 0,
            patient_response: fullResponse.slice(0, 1000),
          });
        } catch (e) {
          console.error("[voice/llm] persist error:", e instanceof Error ? e.message : e);
        }
      }

      controller.enqueue(encoder.encode(sseDone(id, model)));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
