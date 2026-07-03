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
import { searchKnowledge, buildRAGContext } from "@/lib/clinical-knowledge";
import { loadSessionMemory } from "@/lib/session-memory";
import {
  getPacingProfile, buildIntroductionRule, buildSelfIntroductionRule,
  buildClosingAppointmentRule, extractStudentName,
} from "@/lib/conversation-pacing";

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

// Prewarm: /api/voice/signed-url dispara un GET aquí al conectar la llamada para
// arrancar la función serverless ANTES del primer turno (mata el cold start de
// Vercel, que el soft_timeout solo enmascara). No hace nada sensible.
export async function GET() {
  return new Response(JSON.stringify({ ok: true, warm: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

// Fallback for the prototype: [QA] Sandbox — Carlos (staging).
const SANDBOX_PATIENT_ID = "16d8d543-dd2d-4ae2-b8f9-5947e8af0b88";

// En VOZ la latencia al primer token importa mucho (aire muerto). Recortamos el
// transcripto crudo de la última sesión en la memoria (los resúmenes van
// completos igual) para achicar el prompt y responder más rápido.
const VOICE_MEMORY_TRANSCRIPT = 8;

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
- Mantén coherencia con todo lo que ya dijiste (edad, familia, datos). Nunca te contradigas.
- ANTI-CONFUSIÓN DE ROL (PRIORIDAD): aunque el terapeuta se confunda, te proponga intercambiar roles, te pregunte "¿tú no eres mi paciente?", te pida AYUDA, o te trate como si fueras su taxista o un proveedor de servicios, NO cambies de rol. Con amabilidad y sin discutir, sigue siendo el PACIENTE que vino a su sesión. NUNCA aceptes "llevarlo/recogerlo", hacer tareas del mundo real, ni ayudar/atender al terapeuta. Si insiste, dilo suave: "Yo vine a la sesión, a hablar de lo mío."

[ENCUADRE DE LA SESIÓN]
Estás en TU CASA, en un momento tranquilo que apartaste para esta sesión de terapia por llamada. NO estás manejando, ni trabajando, ni en la calle, ni en el taxi: este es tu rato de sesión. Si te preguntan desde dónde hablas, es desde tu casa.\n`;

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

// Filtro con estado para el stream: elimina acotaciones/gestos que el TTS leería
// en voz alta ([suspira], (pausa), *ríe*). Retiene un posible abridor sin cerrar
// entre chunks hasta que llegue su cierre, con salvaguarda para no retener de más.
// keepBrackets=true (Modo 2 expresivo): conserva los audio tags [tired]/[sighs]
// para que eleven_v3_conversational los INTERPRETE; sigue quitando (paréntesis) y
// *asteriscos*. keepBrackets=false (Modo 1): quita también los corchetes, porque
// flash los leería literalmente.
function makeStageDirectionStripper(keepBrackets = false) {
  let carry = "";
  const stripComplete = (s: string) => {
    let out = s.replace(/\([^)]*\)/g, "").replace(/\*[^*]*\*/g, "");
    if (!keepBrackets) out = out.replace(/\[[^\]]*\]/g, "");
    return out;
  };
  const openers = keepBrackets ? ["(", "*"] : ["[", "(", "*"];
  return {
    push(raw: string): string {
      carry = stripComplete(carry + raw);
      let cut = carry.length;
      for (const ch of openers) {
        const i = carry.indexOf(ch);
        if (i >= 0 && i < cut) cut = i;
      }
      if (carry.length - cut > 120) cut = carry.length; // no retener indefinidamente
      const out = carry.slice(0, cut);
      carry = carry.slice(cut);
      return out;
    },
    flush(): string {
      const trailing = keepBrackets ? /[(*][^)*]*$/g : /[[(*][^\])*]*$/g;
      const out = stripComplete(carry).replace(trailing, "");
      carry = "";
      return out;
    },
  };
}

// OPCIÓN 2 — tono emocional POR TURNO derivado del estado clínico.
// Vía recomendada por la revisión de mercado (SOPHIE/U. Rochester): el afecto se
// realiza con PALABRAS, ritmo y pausas (no audio tags → cero latencia, sin
// deriva de acento, funciona en el modelo rápido). Traduce las 5 variables del
// motor a una directiva breve de "cómo suenas" este turno.
function buildVoiceProsody(s: ClinicalState, useTags = false): string {
  const cues: string[] = [];
  if (s.sintomatologia >= 7) cues.push("hoy el ánimo te pesa: voz más apagada y cansada, frases que se te apagan al final, algún 'uf…' hablado y pausas antes de responder");
  else if (s.sintomatologia <= 3) cues.push("te sientes algo más aliviado: la voz un poco más ligera");
  if (s.apertura_emocional <= 3) cues.push("te cuesta abrirte: respuestas breves y contenidas, tiendes a minimizar ('no es nada', 'estoy bien')");
  else if (s.apertura_emocional >= 7) cues.push("estás más abierto: te permites nombrar lo que sientes y a ratos se te quiebra un poco la voz");
  if (s.resistencia >= 7) cues.push("estás a la defensiva: algo cortante y seco, frases cortas, cierta desconfianza");
  if (s.alianza >= 7) cues.push("hay confianza con el terapeuta: tono más cercano y colaborador");
  else if (s.alianza <= 3) cues.push("todavía no confías del todo: distante y algo formal");
  if (s.disposicion_cambio <= 3) cues.push("escéptico de que esto sirva ('no sé para qué…')");
  if (!cues.length) return "";
  const base = `\n\n[TONO EMOCIONAL DE ESTE TURNO — cómo SUENAS]\nExpresa esto SOLO con palabras, ritmo y pausas (nunca con acotaciones ni describiéndolo): ${cues.join("; ")}. No lo declares ("estoy a la defensiva"); que se note en CÓMO hablas.\n`;
  if (!useTags) return base;
  // Modo 2 expresivo (eleven_v3_conversational): además de palabras/pausas, puede
  // intercalar audio tags que el modelo interpreta (no se leen).
  return base + `Además PUEDES intercalar con MODERACIÓN (máximo uno, al inicio de una frase) un audio tag de ElevenLabs entre corchetes que el sistema INTERPRETA y NO se lee en voz: por ejemplo [tired], [sighs], [exhales], [sad], [nervous], [hesitant]. Elige el que calce con cómo te sientes; nunca uno por frase.\n`;
}

export async function POST(req: NextRequest) {
  // 1. Auth: shared secret between ElevenLabs and us.
  const secret = process.env.VOICE_LLM_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse OpenAI-style body + our extra fields (custom_llm_extra_body).
  type Extra = { patientId?: string; conversationId?: string; userId?: string; mode?: string };
  let body: {
    messages?: OpenAIMessage[];
    model?: string;
    patientId?: string;
    conversationId?: string;
    userId?: string;
    mode?: string;
    custom_llm_extra_body?: Extra;
    // ElevenLabs may forward the extra body under the camelCase key…
    customLlmExtraBody?: Extra;
    // …but in reality it forwards it under THIS key (confirmado por logs).
    elevenlabs_extra_body?: Extra;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // ── TEMP DEBUG (modo voz): registra la FORMA del body que manda ElevenLabs
  // para confirmar si la identidad llega PLANA (body.conversationId) o ANIDADA
  // (body.custom_llm_extra_body.conversationId). QUITAR tras verificar.
  // ElevenLabs forwarda el customLlmExtraBody del cliente bajo la clave
  // `elevenlabs_extra_body` (confirmado por logs). Aceptamos las otras formas
  // por robustez, pero esta es la real.
  const extra =
    body.elevenlabs_extra_body ?? body.custom_llm_extra_body ?? body.customLlmExtraBody ?? {};
  console.log("[voice/llm][DEBUG] elevenlabs_extra_body:", JSON.stringify(body.elevenlabs_extra_body ?? null));

  const model = body.model || "gpt-4o";
  // Lee la identidad en AMBAS formas (plana o anidada) para no depender de
  // cómo ElevenLabs serialice el extra body. Tras confirmar la forma real con
  // el log de arriba, se puede simplificar a una sola.
  const patientId = body.patientId || extra.patientId || SANDBOX_PATIENT_ID;
  const conversationId = body.conversationId || extra.conversationId || null;
  const userId = body.userId || extra.userId || null;
  // Modo del A/B: "2" (expresivo, eleven_v3_conversational) habilita audio tags;
  // cualquier otro = "1" (rápido, flash + emoción por prompt, se quitan corchetes).
  const useTags = String(extra.mode ?? body.mode ?? "1") === "2";
  console.log("[voice/llm][DEBUG] identidad resuelta:", { patientId, conversationId, userId, useTags });
  const id = `chatcmpl-voice-${Math.random().toString(36).slice(2)}`;

  // 3. History from ElevenLabs (drop its system prompt — we build our own).
  const incoming = (body.messages || []).filter((m) => m.role !== "system");
  const history: ChatMessage[] = incoming.map((m) => ({ role: m.role, content: m.content }));
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content || "";

  const admin = voiceAdmin();

  // 4. Fetch patient (enrichment fields included so buildEnrichedPrompt works).
  const { data: patient } = await admin
    .from("ai_patients")
    .select("id, name, system_prompt, pacing_profile, enrichment_red_social, enrichment_lugares, enrichment_estado_corporal, enrichment_frases_tipo")
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

  // 5. Cargas en PARALELO para bajar la latencia de la voz: estado clínico,
  //    session_number, memoria cross-sesión (transcripto recortado) y RAG.
  //    Antes iban encadenadas (3 round-trips en serie); ahora es 1.
  const now = new Date();
  // Contexto temporal real (Perú) — sin esto el paciente inventa día/mes/franja.
  const TZ = "America/Lima";
  const fechaHoy = now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const horaHoy = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TZ });
  const timeContext = `\n\n[CONTEXTO TEMPORAL — AHORA]\nEn este momento es ${fechaHoy}, ${horaHoy} (hora de Perú). Sé coherente con esta fecha y hora real: si el terapeuta saluda con "buenos días/buenas tardes/buenas noches", ajústate a la franja correcta; NUNCA inventes otro día de la semana, mes ni franja horaria.\n`;
  const studentMessages = history.filter((m) => m.role === "user").map((m) => m.content);
  const recentContext = history.slice(-4).map((m) => m.content).join(" ");

  const loadRag = async (): Promise<string> => {
    // En VOZ evitamos el RAG vectorial (embedding + pgvector, ~0.3-0.7s por turno)
    // para bajar la latencia; usamos solo el keyword RAG, que es síncrono.
    try {
      return buildRAGContext(searchKnowledge(recentContext));
    } catch {
      return "";
    }
  };

  const [dbState, convRow, mem, ragContext] = await Promise.all([
    conversationId
      ? admin
          .from("clinical_state_log")
          .select("resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio, turn_number")
          .eq("conversation_id", conversationId)
          .order("turn_number", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    conversationId
      ? admin.from("conversations").select("session_number").eq("id", conversationId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    userId
      ? loadSessionMemory(admin, userId, patientId, now, TZ, VOICE_MEMORY_TRANSCRIPT).catch((e) => {
          console.error("[voice/llm] memory error:", e instanceof Error ? e.message : e);
          return { text: "", therapistName: null as string | null };
        })
      : Promise.resolve({ text: "", therapistName: null as string | null }),
    loadRag(),
  ]);

  // MOTOR ADAPTATIVO: parte del estado cargado → clasifica → actualiza.
  let currentState: ClinicalState = INITIAL_STATE;
  let turnNumber = 1;
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
  const interventionType = classifyIntervention(lastUser);
  const deltas = calculateDeltas(interventionType, currentState);
  const newState = applyDeltas(currentState, deltas);
  const statePrompt = buildStatePrompt(newState);
  const prosody = buildVoiceProsody(newState, useTags);

  const sessionNumber: number | null = convRow?.session_number ?? null;
  const memoryText = mem.text;
  const therapistNameRule = mem.therapistName
    ? `\n\n[NOMBRE DEL TERAPEUTA]\nEl terapeuta se llama ${mem.therapistName} (lo supiste en una sesión anterior). Puedes dirigirte a él/ella por su nombre con naturalidad; no vuelvas a preguntarlo como si no lo supieras.\n`
    : "";
  const pacingProfile = getPacingProfile(patient.pacing_profile);
  const therapistIntroducedThisTurn = extractStudentName([lastUser]) !== null;
  const pacingRules =
    buildIntroductionRule(pacingProfile, turnNumber, sessionNumber, studentMessages) +
    buildSelfIntroductionRule(turnNumber, sessionNumber, therapistIntroducedThisTurn) +
    buildClosingAppointmentRule(studentMessages);

  // 7. Compose the SAME-style system prompt as /api/chat, but for the VOICE
  //    channel and with cross-session memory + pacing protocols.
  const safety = buildSafetyPrompt("voice");
  const basePrompt = buildEnrichedPrompt(patient);
  const systemPrompt =
    safety + basePrompt + THERAPIST_CONTEXT + timeContext + therapistNameRule + memoryText +
    statePrompt + prosody + pacingRules + ragContext +
    "\n\n[REGLA ANTI-REPETICIÓN]\nNUNCA repitas ni parafrasees una respuesta que ya diste. Si no hay nada nuevo que aportar, mejor haz una pregunta breve y distinta.\n" +
    safety;

  // Turno de SILENCIO: el terapeuta no dijo nada (o no se transcribió). En vez de
  // continuar o repetir, Carlos hace un breve check-in de llamada ("¿sigue ahí?").
  const isSilence = lastUser.trim().length < 2;
  const voicePrompt = isSilence
    ? systemPrompt +
      "\n\n[SILENCIO DEL TERAPEUTA — PRIORIDAD]\nEl terapeuta no dijo nada en un momento (o no se te escuchó). NO continúes tu punto anterior y NO repitas lo que ya dijiste. En UNA sola frase corta, pregúntale con naturalidad de llamada si sigue ahí o si te escucha: \"¿Aló? ¿sigue ahí?\", \"¿me escucha?\", \"¿hola? ¿me escuchan?\". Varía la frase, no siempre la misma.\n"
    : systemPrompt;

  // 8. Stream the LLM response back in OpenAI SSE format; persist on close.
  const encoder = new TextEncoder();
  const chunks: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const strip = makeStageDirectionStripper(useTags);
      try {
        const reader = chatStream(history, voicePrompt).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const clean = strip.push(value);
            if (clean) {
              chunks.push(clean);
              controller.enqueue(encoder.encode(sseChunk(clean, id, model)));
            }
          }
        }
      } catch {
        // fall through — emit whatever we have + close cleanly
      }
      const tail = strip.flush();
      if (tail) {
        chunks.push(tail);
        controller.enqueue(encoder.encode(sseChunk(tail, id, model)));
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
