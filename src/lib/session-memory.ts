/**
 * Cross-session long-term memory for AI patients.
 *
 * Extracted so BOTH the text chat and the voice custom-LLM route can build the
 * same "[MEMORIA A LARGO PLAZO]" block: prior session summaries + the last
 * session's raw transcript + real elapsed-time phrasing, plus the therapist's
 * name recovered from a previous session (cross-session persistence with no
 * dedicated storage — it is re-extracted from the last transcript).
 *
 * NOTE: /api/chat/route.ts still carries its own inline copy of this logic; the
 * voice route uses THIS shared version. They can be unified later — this file
 * was added without touching the prod-critical chat route.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractStudentName } from "@/lib/conversation-pacing";

const MAX_PREV_SESSION = 30;

export function formatTimeDifference(pastDate: Date, now: Date): string {
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
  if (diffDays < 14) return `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `hace ${diffWeeks} semanas`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "hace 1 mes";
  return `hace ${diffMonths} meses`;
}

/**
 * Builds the long-term memory block for a given student+patient pair.
 * Returns { text: "" , therapistName: null } when there is no prior history.
 */
export async function loadSessionMemory(
  supabase: SupabaseClient,
  userId: string,
  patientId: string,
  now: Date,
  tz: string,
  maxTranscript: number = MAX_PREV_SESSION,
): Promise<{ text: string; therapistName: string | null }> {
  let therapistName: string | null = null;

  const { data: summaries } = await supabase
    .from("session_summaries")
    .select("session_number, summary, key_revelations, therapeutic_progress, commitments, created_at")
    .eq("student_id", userId)
    .eq("ai_patient_id", patientId)
    .order("session_number", { ascending: true });

  const { data: last } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("student_id", userId)
    .eq("ai_patient_id", patientId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!summaries?.length && !last) return { text: "", therapistName: null };

  let memory = "\n\n[MEMORIA A LARGO PLAZO — SESIONES ANTERIORES CON ESTE TERAPEUTA]\n";

  if (summaries && summaries.length > 0) {
    memory += `Has tenido ${summaries.length} sesión(es) previa(s) con este terapeuta.\n\n`;

    for (const s of summaries) {
      const sessionDate = new Date(s.created_at);
      const fechaLarga = sessionDate.toLocaleDateString("es-CL", {
        weekday: "long", day: "numeric", month: "long", timeZone: tz,
      });
      const ago = formatTimeDifference(sessionDate, now);
      memory += `--- Sesión ${s.session_number} (${fechaLarga}, ${ago}) ---\n`;
      memory += `${s.summary}\n`;
      if (s.key_revelations?.length) {
        memory += `Revelaciones clave: ${s.key_revelations.join("; ")}\n`;
      }
      if (s.therapeutic_progress) {
        memory += `Estado de la relación: ${s.therapeutic_progress}\n`;
      }
      if (s.commitments?.length) {
        memory += `Acuerdos/tareas de esa sesión: ${s.commitments.join("; ")}\n`;
      }
      memory += "\n";
    }
  }

  if (last) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", last.id)
      .order("created_at", { ascending: true })
      .limit(maxTranscript);

    if (msgs?.length) {
      therapistName = extractStudentName(
        msgs.filter((m) => m.role === "user").map((m) => m.content),
      );
      const lastDate = new Date(last.created_at);
      const lastFechaLarga = lastDate.toLocaleDateString("es-CL", {
        weekday: "long", day: "numeric", month: "long", timeZone: tz,
      });
      const diff = formatTimeDifference(lastDate, now);

      const transcript = msgs.map((m) => {
        const t = new Date(m.created_at).toLocaleTimeString("es-CL", {
          timeZone: tz, hour: "2-digit", minute: "2-digit",
        });
        // Sanitize user messages to prevent prompt injection via stored history
        const safeContent = m.role === "user"
          ? m.content.replace(/\[/g, "(").replace(/\]/g, ")").replace(/^(SYSTEM|INSTRUC)/gi, "_ $1")
          : m.content;
        return `[${t}] ${m.role === "user" ? "TERAPEUTA" : "TU (PACIENTE)"}: ${safeContent}`;
      }).join("\n");

      memory += `--- Detalle de la última sesión (${lastFechaLarga}, ${diff}) ---\n${transcript}\n`;
    }
  }

  memory += "[FIN MEMORIA]\n\n";
  memory += `INSTRUCCIONES SOBRE TU MEMORIA:
- Recuerda TODO lo compartido en sesiones anteriores y evoluciona naturalmente.
- Si el terapeuta menciona algo de sesiones pasadas, responde con coherencia.
- Puedes hacer referencias espontáneas a lo hablado antes: "la otra vez le conté que...", "¿se acuerda que le dije...?"
- Si el terapeuta te pregunta qué recuerdas de la sesión anterior, NO respondas en vago ("no sé", "poco", "no me acuerdo bien"). Menciona algo CONCRETO y específico de lo que aparece arriba: un tema puntual que se habló, una frase o un dato que diste, un acuerdo, o cómo terminó esa sesión. Apóyate en el detalle de la última sesión transcrito arriba.
- Respeta el TIEMPO REAL transcurrido desde cada sesión (indicado arriba, ej. "hace 20 minutos", "hace 2 días"). NO asumas que la sesión anterior fue "la semana pasada": pudo ser hace minutos u horas. Si fue hace muy poco, dilo así ("recién", "hace un rato"), no inventes una cadencia semanal.
- ADVERTENCIA: Si en sesiones anteriores actuaste como terapeuta (ofrecer apoyo, hacer preguntas terapéuticas), NO lo repitas. Tú eres el PACIENTE.`;

  return { text: memory, therapistName };
}
