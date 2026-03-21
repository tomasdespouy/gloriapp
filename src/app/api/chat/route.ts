import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatStream, type ChatMessage } from "@/lib/ai";
import { z } from "zod";
import {
  classifyIntervention, calculateDeltas, applyDeltas,
  buildStatePrompt, INITIAL_STATE, type ClinicalState,
} from "@/lib/clinical-state-engine";
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
  // Use admin client to bypass RLS (students can't read ai_patients directly)
  const patient = await pCache.getOrSet(
    `patient:${patientId}`,
    async () => {
      const { data } = await createAdminClient()
        .from("ai_patients")
        .select("id, name, system_prompt, country_origin, country_residence, neighborhood")
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

  // 6. Save message + load history + await memory — all in parallel
  const [, { data: history }, memoryContext] = await Promise.all([
    supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: message }),
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY),
    memoryPromise,
  ]);

  let chronological = (history || []).reverse();

  // Guard: ensure the user message is always present (race condition: insert may not
  // be visible to the parallel SELECT on the first message of a conversation)
  const hasUserMsg = chronological.some((m) => m.role === "user" && m.content === message);
  if (!hasUserMsg) {
    chronological = [...chronological, { role: "user", content: message }];
  }

  // 7. MOTOR ADAPTATIVO: classify intervention + update state
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

  // If no state in current conversation, try to inherit from last session (same student)
  let currentState: ClinicalState;
  if (lastState) {
    currentState = lastState.state;
  } else {
    // Try to inherit from last completed session's final state
    const { data: prevSummary } = await admin
      .from("session_summaries")
      .select("final_clinical_state")
      .eq("student_id", user.id)
      .eq("ai_patient_id", patientId)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevSummary?.final_clinical_state) {
      const ps = prevSummary.final_clinical_state as Record<string, number>;
      currentState = {
        resistencia: ps.resistencia ?? INITIAL_STATE.resistencia,
        alianza: ps.alianza ?? INITIAL_STATE.alianza,
        apertura_emocional: ps.apertura_emocional ?? INITIAL_STATE.apertura_emocional,
        sintomatologia: ps.sintomatologia ?? INITIAL_STATE.sintomatologia,
        disposicion_cambio: ps.disposicion_cambio ?? INITIAL_STATE.disposicion_cambio,
      };
    } else {
      currentState = INITIAL_STATE;
    }
  }

  const turnNumber = (lastState?.turn || 0) + 1;

  // Classify the therapist's intervention
  const interventionType = classifyIntervention(message);

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
  const firstTurnRule = turnNumber <= 2
    ? `\n\n[INICIO DE SESI\u00d3N — TURNOS ${turnNumber}/2]
Es el comienzo de la sesi\u00f3n. S\u00e9 BREVE y CAUTELOSO(A):
- M\u00e1ximo 1-2 oraciones en tu respuesta.
- No cuentes detalles de tu vida a\u00fan. Solo responde lo m\u00ednimo necesario.
- Muestra incomodidad, timidez o desconfianza natural de un paciente que reci\u00e9n conoce a su terapeuta.
- NO expliques tu problem\u00e1tica completa. Solo da pistas vagas si te preguntan directamente.
- Espera a que el terapeuta genere confianza antes de abrirte.\n`
    : "";

  const systemPrompt = patient.system_prompt + timeContext + therapistContext + memoryContext
    + statePrompt
    + firstTurnRule
    + ragContext
    + "\n\n[REGLA ANTI-REPETICI\u00d3N]\nNUNCA repitas textualmente una respuesta que ya diste en esta conversaci\u00f3n.\n";

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

  // Sanitize historical messages: convert first-person brackets to third person
  // so the LLM doesn't copy old patterns like [me siento incómoda]
  const sanitizedHistory = (chronological as ChatMessage[]).map((m) => {
    if (m.role !== "assistant") return m;
    return {
      ...m,
      content: m.content.replace(/\[([^\]]+)\]/g, (match, inner) => {
        // Convert first-person to third person inside brackets
        let fixed = inner
          .replace(/\bme\s+/gi, "se ")
          .replace(/\bmi\s+/gi, "su ")
          .replace(/\bmis\s+/gi, "sus ")
          .replace(/\bmiro\b/gi, "mira")
          .replace(/\bsuspiro\b/gi, "suspira")
          .replace(/\bsonrío\b/gi, "sonríe")
          .replace(/\bsiento\b/gi, "siente")
          .replace(/\bestoy\b/gi, "está")
          .replace(/\bjuego\b/gi, "juega")
          .replace(/\bencojo\b/gi, "encoge")
          .replace(/\bacomodo\b/gi, "acomoda")
          .replace(/\bcruzo\b/gi, "cruza")
          .replace(/\bmuerdo\b/gi, "muerde")
          .replace(/\btoco\b/gi, "toca")
          .replace(/\bagarro\b/gi, "agarra");
        return `[${fixed}]`;
      }),
    };
  });

  // 8. Stream LLM response (array accumulator — O(n) instead of O(n²))
  const chunks: string[] = [];
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "conversation_id", value: conversationId })}\n\n`)
        );

        const reader = chatStream(sanitizedHistory, systemPrompt).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "token", value })}\n\n`)
          );
        }

        const patientResponse = chunks.join("");

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: patientResponse,
        });

        // Save clinical state log (trazabilidad causal)
        await admin.from("clinical_state_log").insert({
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
        }); // Non-blocking state log

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

// --- Load multi-session memory (summaries + last session detail) ---
async function loadMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  patientId: string,
  now: Date,
): Promise<string> {
  // Load ALL session summaries for this student+patient
  const { data: summaries } = await supabase
    .from("session_summaries")
    .select("session_number, summary, key_revelations, therapeutic_progress, created_at")
    .eq("student_id", userId)
    .eq("ai_patient_id", patientId)
    .order("session_number", { ascending: true });

  // Also load last session's raw messages for recent detail
  const { data: last } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("student_id", userId)
    .eq("ai_patient_id", patientId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!summaries?.length && !last) return "";

  let memory = "\n\n[MEMORIA A LARGO PLAZO — SESIONES ANTERIORES CON ESTE TERAPEUTA]\n";

  // Multi-session summaries (compact, all sessions)
  if (summaries && summaries.length > 0) {
    memory += `Has tenido ${summaries.length} sesión(es) previa(s) con este terapeuta.\n\n`;

    for (const s of summaries) {
      const sessionDate = new Date(s.created_at);
      const ago = formatTimeDifference(sessionDate, now);
      memory += `--- Sesión ${s.session_number} (${ago}) ---\n`;
      memory += `${s.summary}\n`;
      if (s.key_revelations?.length) {
        memory += `Revelaciones clave: ${s.key_revelations.join("; ")}\n`;
      }
      if (s.therapeutic_progress) {
        memory += `Estado de la relación: ${s.therapeutic_progress}\n`;
      }
      memory += "\n";
    }
  }

  // Last session raw detail (for recent conversational continuity)
  if (last) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", last.id)
      .order("created_at", { ascending: true })
      .limit(MAX_PREV_SESSION);

    if (msgs?.length) {
      const lastDate = new Date(last.created_at);
      const diff = formatTimeDifference(lastDate, now);

      const transcript = msgs.map((m) => {
        const t = new Date(m.created_at).toLocaleTimeString("es-CL", {
          timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit",
        });
        return `[${t}] ${m.role === "user" ? "TERAPEUTA" : "TU (PACIENTE)"}: ${m.content}`;
      }).join("\n");

      memory += `--- Detalle de la última sesión (${diff}) ---\n${transcript}\n`;
    }
  }

  memory += "[FIN MEMORIA]\n\n";
  memory += `INSTRUCCIONES SOBRE TU MEMORIA:
- Recuerda TODO lo compartido en sesiones anteriores y evoluciona naturalmente.
- Si el terapeuta menciona algo de sesiones pasadas, responde con coherencia.
- Puedes hacer referencias espontáneas a lo hablado antes: "la otra vez le conté que...", "¿se acuerda que le dije...?"
- ADVERTENCIA: Si en sesiones anteriores actuaste como terapeuta (ofrecer apoyo, hacer preguntas terapéuticas), NO lo repitas. Tú eres el PACIENTE.`;

  return memory;
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
