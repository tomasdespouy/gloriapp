import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatStream, type ChatMessage } from "@/lib/ai";
import { z } from "zod";
import {
  classifyWithLLM, calculateDeltas, applyDeltas,
  buildStatePrompt, INITIAL_STATE, type ClinicalState,
} from "@/lib/clinical-state-engine";
import { chat as chatEval } from "@/lib/ai";
import { searchKnowledge, buildRAGContext } from "@/lib/clinical-knowledge";
import { searchVectorRAG, buildVectorRAGContext } from "@/lib/vector-rag";
import { logger } from "@/lib/logger";
import { patientCache as pCache, stateCache } from "@/lib/cache";

const chatRequestSchema = z.object({
  patientId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(5000),
});

const MAX_HISTORY = 50;
const MAX_PREV_SESSION = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body;
  try {
    const raw = await request.json();
    body = chatRequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { patientId, message } = body;
  let conversationId = body.conversationId;

  // 3. Fetch patient (cached 10 min — prompts rarely change)
  const patient = await pCache.getOrSet(
    `patient:${patientId}`,
    async () => {
      const { data } = await supabase
        .from("ai_patients")
        .select("id, name, system_prompt, country_origin, country_residence, neighborhood, difficulty_level")
        .eq("id", patientId)
        .single();
      if (!data) throw new Error("Patient not found");
      return data;
    },
    600 // 10 min TTL
  ).catch(() => null);

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // 4. Time context + memory (start loading in parallel)
  const now = new Date();
  const countryTimezones: Record<string, string> = {
    "Chile": "America/Santiago",
    "Argentina": "America/Argentina/Buenos_Aires",
    "Colombia": "America/Bogota",
    "México": "America/Mexico_City",
    "Perú": "America/Lima",
    "España": "Europe/Madrid",
    "Ecuador": "America/Guayaquil",
    "Bolivia": "America/La_Paz",
    "Uruguay": "America/Montevideo",
    "Paraguay": "America/Asuncion",
    "Venezuela": "America/Caracas",
    "República Dominicana": "America/Santo_Domingo",
  };
  const residence = patient.country_residence || "Chile";
  const tz = countryTimezones[residence] || "America/Santiago";
  const currentDateTime = now.toLocaleString("es-CL", {
    timeZone: tz,
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const locationContext = patient.country_origin && patient.country_origin !== residence
    ? `Naciste en ${patient.country_origin} y actualmente vives en ${residence}${patient.neighborhood ? `, en el sector de ${patient.neighborhood}` : ""}.`
    : `Vives en ${residence}${patient.neighborhood ? `, en el sector de ${patient.neighborhood}` : ""}.`;
  const timeContext = `\n\n[CONTEXTO TEMPORAL Y GEOGRÁFICO]\nLa fecha y hora actual es: ${currentDateTime} (zona horaria de ${residence}). ${locationContext}\nUsa SIEMPRE esta fecha como referencia. Hoy es este día, no otro. Tu país de residencia es ${residence}, NO otro.\n`;

  const therapistContext = `\n\n[REGLA CRÍTICA DE ROLES — LEE ESTO ANTES DE RESPONDER]
Tú eres ${patient.name}. Eres el/la PACIENTE que viene a terapia.
La persona que te escribe (role "user") es el/la TERAPEUTA, el/la profesional.

PROHIBIDO (nunca hagas esto):
- NO digas "estoy aquí para escucharte/escucharle" — eso lo dice un terapeuta, no un paciente
- NO digas "puede compartir lo que desee" — eso es lenguaje de terapeuta
- NO hagas preguntas terapéuticas como "¿cómo se siente con eso?" o "¿quiere hablar de algo?"
- NO ofrezcas apoyo emocional ni contención — tú RECIBES apoyo, no lo das
- NO actúes como consejero, guía ni profesional de salud mental
- NO uses frases como "me alegra escuchar eso", "si hay algo que desee abordar" — son de terapeuta

TU ROL COMO PACIENTE:
- Hablas de TUS problemas, TUS emociones, TU vida
- Respondes las preguntas del terapeuta desde tu experiencia personal
- Puedes preguntar cosas como "¿usted cree que estoy mal?" o "¿esto es normal?" — preguntas de paciente
- Si no sabes el nombre del terapeuta, dile "doctor(a)" o "usted"
- NUNCA lo llames por tu propio nombre (${patient.name})\n`;

  const memoryPromise = loadMemory(supabase, user.id, patientId, now);

  // LLM classification — fire early, resolve later (5s timeout + heuristic fallback)
  const classifyPromise = classifyWithLLM(message, chatEval);

  // 5. Create or use existing conversation
  if (!conversationId) {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .eq("ai_patient_id", patientId);

    const { data: conv } = await supabase
      .from("conversations")
      .insert({ student_id: user.id, ai_patient_id: patientId, session_number: (count || 0) + 1, status: "active" })
      .select("id")
      .single();

    if (!conv) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    conversationId = conv.id;
  }

  // 6. Save message + load history + await memory + classify — all in parallel
  const [, { data: history }, memoryContext, interventionType] = await Promise.all([
    supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: message }),
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY),
    memoryPromise,
    classifyPromise,
  ]);

  const chronological = (history || []).reverse();

  // 7. MOTOR ADAPTATIVO: update state using LLM-classified intervention
  const admin = createAdminClient();

  // Load current state (cached per conversation to avoid DB roundtrip)
  const cachedState = stateCache.get<{ state: ClinicalState; turn: number }>(`state:${conversationId}`);

  let lastState = cachedState;
  if (!lastState) {
    const { data: dbState } = await admin
      .from("clinical_state_log")
      .select("resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio, turn_number")
      .eq("conversation_id", conversationId)
      .order("turn_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbState) {
      lastState = {
        state: {
          resistencia: Number(dbState.resistencia),
          alianza: Number(dbState.alianza),
          apertura_emocional: Number(dbState.apertura_emocional),
          sintomatologia: Number(dbState.sintomatologia),
          disposicion_cambio: Number(dbState.disposicion_cambio),
        },
        turn: dbState.turn_number,
      };
    }
  }

  const currentState: ClinicalState = lastState
    ? lastState.state
    : INITIAL_STATE;

  const turnNumber = (lastState?.turn || 0) + 1;

  // Calculate how it affects the patient
  const deltas = calculateDeltas(interventionType, currentState);

  // Apply the changes
  const newState = applyDeltas(currentState, deltas);

  // Cache the new state for next message (avoid DB roundtrip)
  stateCache.set(`state:${conversationId}`, { state: newState, turn: turnNumber }, 1800);

  // Build state-conditioned prompt
  const statePrompt = buildStatePrompt(newState);

  // 8. RAG: Search clinical knowledge (vector DB with semantic search)
  const recentContext = chronological.slice(-4).map((m) => m.content).join(" ") + " " + message;

  // Try vector RAG first, fallback to keyword RAG
  let ragContext = "";
  const vectorResults = await searchVectorRAG(recentContext, 3, 0.40);
  if (vectorResults.length > 0) {
    ragContext = buildVectorRAGContext(vectorResults);
  } else {
    // Fallback to keyword-based RAG
    const keywordEntries = searchKnowledge(recentContext);
    ragContext = buildRAGContext(keywordEntries);
  }

  // 9. Build system prompt WITH state + RAG
  const systemPrompt = patient.system_prompt + timeContext + therapistContext + memoryContext
    + statePrompt
    + ragContext
    + "\n\n[REGLA ANTI-REPETICIÓN]\nNUNCA repitas textualmente una respuesta que ya diste en esta conversación.\n";

  // Log session context
  logger.info("chat_message", {
    conversationId,
    patientId,
    userId: user.id,
    interventionType,
    turnNumber,
    state: newState,
    ragResults: vectorResults.length,
    promptLength: systemPrompt.length,
  });

  const streamStart = Date.now();

  // Micro-feedback for beginner patients — fire in parallel with streaming
  const isBeginner = patient.difficulty_level === "beginner";
  const microFeedbackPromise = isBeginner
    ? chatEval(
        [{ role: "user", content: `Intervención del terapeuta estudiante: "${message}"
Tipo clasificado: ${interventionType}

Da UN micro-consejo breve (máximo 20 palabras) sobre esta intervención.
Si fue buena, refuérzala brevemente. Si puede mejorar, sugiere una alternativa concreta.
Responde SOLO con el consejo, sin prefijos ni explicación.` }],
        "Eres un supervisor clínico que da micro-feedback formativo a estudiantes de psicología. Sé directo, cálido y conciso."
      ).catch(() => null)
    : Promise.resolve(null);

  // 8. Stream LLM response (array accumulator — O(n) instead of O(n²))
  const chunks: string[] = [];
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "conversation_id", value: conversationId })}\n\n`)
        );

        const reader = chatStream(chronological as ChatMessage[], systemPrompt).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "token", value })}\n\n`)
          );
        }

        const patientResponse = chunks.join("");

        // Save message + state log in parallel
        await Promise.all([
          supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: patientResponse,
          }).then(),
          admin.from("clinical_state_log").insert({
            conversation_id: conversationId,
            turn_number: turnNumber,
            intervention_type: interventionType,
            intervention_raw: message,
            ...newState,
            delta_resistencia: deltas.resistencia || 0,
            delta_alianza: deltas.alianza || 0,
            delta_apertura: deltas.apertura_emocional || 0,
            delta_sintomatologia: deltas.sintomatologia || 0,
            delta_disposicion: deltas.disposicion_cambio || 0,
            patient_response: patientResponse.slice(0, 1000),
          }).then(),
        ]);

        // Micro-feedback for beginner patients (arrives after streaming)
        if (isBeginner) {
          const feedback = await microFeedbackPromise;
          if (feedback) {
            const annotation = feedback.trim().slice(0, 200);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "micro_feedback", value: annotation, intervention: interventionType })}\n\n`)
            );
            // Save to message_annotations (best-effort)
            const { data: userMsg } = await admin
              .from("messages")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (userMsg) {
              await admin.from("message_annotations").insert({
                message_id: userMsg.id,
                annotation_type: "suggestion",
                annotation_text: annotation,
                competency: interventionType,
              }).then();
            }
          }
        }

        // Performance metrics
        logger.metric("chat_response", {
          conversationId,
          turnNumber,
          duration_ms: Date.now() - streamStart,
          responseLength: patientResponse.length,
          responseWords: patientResponse.split(/\s+/).length,
          interventionType,
          stateAfter: newState,
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        logger.error("chat_error", { conversationId, turnNumber, error: errorMsg, duration_ms: Date.now() - streamStart });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", value: errorMsg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

// --- Load previous session memory ---
async function loadMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  patientId: string,
  now: Date,
): Promise<string> {
  // Try cumulative narrative first (compact, multi-session)
  const [{ data: narrative }, { data: last }] = await Promise.all([
    supabase
      .from("patient_narratives")
      .select("narrative, key_themes, sessions_included, updated_at")
      .eq("student_id", userId)
      .eq("ai_patient_id", patientId)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id, created_at")
      .eq("student_id", userId)
      .eq("ai_patient_id", patientId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!last) return "";

  const lastDate = new Date(last.created_at);
  const diff = formatTimeDifference(lastDate, now);

  // Use cumulative narrative if available
  if (narrative?.narrative) {
    const themes = narrative.key_themes?.length
      ? `\nTemas recurrentes: ${narrative.key_themes.join(", ")}`
      : "";

    return `\n\n[MEMORIA ACUMULATIVA — ${narrative.sessions_included} sesión(es) con este terapeuta]
${narrative.narrative}${themes}
[FIN MEMORIA]

IMPORTANTE sobre la memoria:
- Tu última sesión fue ${diff}. Si preguntan cuándo hablaron, di "${diff}".
- Has tenido ${narrative.sessions_included} sesión(es) con este terapeuta en total.
- Recuerda lo compartido y evoluciona naturalmente.
- ADVERTENCIA: Tú eres el PACIENTE, no el terapeuta. No ofrezcas apoyo ni hagas preguntas terapéuticas.`;
  }

  // Fallback: raw transcript from last session (for sessions before narrative was enabled)
  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", last.id)
    .order("created_at", { ascending: true })
    .limit(MAX_PREV_SESSION);

  if (!msgs?.length) return "";

  const dateStr = lastDate.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const transcript = msgs.map((m) => {
    const t = new Date(m.created_at).toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit",
    });
    return `[${t}] ${m.role === "user" ? "TERAPEUTA" : "TU (PACIENTE)"}: ${m.content}`;
  }).join("\n");

  return `\n\n[MEMORIA DE SESIÓN ANTERIOR]\nTu última sesión con este terapeuta fue el ${dateStr} (${diff}).\nConversación:\n${transcript}\n[FIN MEMORIA]\n\nIMPORTANTE sobre la memoria:\n- La última sesión fue ${diff}. Si preguntan cuándo hablaron, di "${diff}".\n- Recuerda lo compartido y evoluciona naturalmente.\n- ADVERTENCIA: Tú eres el PACIENTE, no el terapeuta. No ofrezcas apoyo ni hagas preguntas terapéuticas.`;
}

function formatTimeDifference(pastDate: Date, now: Date): string {
  const diffMs = now.getTime() - pastDate.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "hace menos de un minuto";
  if (diffMin === 1) return "hace 1 minuto";
  if (diffMin < 60) return `hace ${diffMin} minutos`;
  if (diffHours === 1) return "hace 1 hora";
  if (diffHours < 24) return `hace ${diffHours} horas`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "hace 1 semana";
  if (diffDays < 30) return `hace ${diffWeeks} semanas`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "hace 1 mes";
  return `hace ${diffMonths} meses`;
}
