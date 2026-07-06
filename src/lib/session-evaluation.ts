import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import {
  EVALUATION_PROMPT,
  activeModelLabel,
  buildCompetencyUpsert,
  buildUserMessage,
  normalizeEvaluation,
} from "@/lib/evaluation-prompt";
import { canViewStudent } from "@/lib/section-scope";
import { logEmail } from "@/lib/email-log";

type Admin = ReturnType<typeof createAdminClient>;

// ─────────────────────────────────────────────────────────────────
// Motor de evaluación de sesión, CENTRALIZADO.
//
// Antes la lógica vivía duplicada en /api/sessions/[id]/complete y
// /api/admin/reeval-session (y el resumen solo en complete). Ahora las tres
// piezas — evaluación IA, resumen de sesión y aviso al docente — viven acá y
// las reusan: /complete (resumen), reeval-session (botón/CRON) y el cron de
// barrido que recupera sesiones que quedaron sin evaluar.
// ─────────────────────────────────────────────────────────────────

/** Resumen observacional de la sesión para la memoria multi-sesión. */
export async function generateSessionSummary(
  admin: Admin,
  conversationId: string,
  studentId: string,
  patientId: string,
  transcript: string,
) {
  const { data: conv } = await admin
    .from("conversations")
    .select("session_number")
    .eq("id", conversationId)
    .single();

  const { data: finalState } = await admin
    .from("clinical_state_log")
    .select("resistencia, alianza, apertura_emocional, sintomatologia, disposicion_cambio")
    .eq("conversation_id", conversationId)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summaryResponse = await chat(
    [{ role: "user", content: `Resume esta sesión terapéutica de forma neutral y observacional.

TRANSCRIPCIÓN:
${transcript}

Responde SOLO con JSON válido:
{
  "summary": "Resumen narrativo de 80-120 palabras en tercera persona neutral. Qué temas se abordaron, cómo reaccionó el paciente, qué intervenciones realizó el terapeuta. Incluir datos concretos mencionados (nombres, lugares, eventos).",
  "key_revelations": ["Dato o información clínicamente relevante que surgió", "Otro dato relevante"],
  "commitments": ["Acuerdos concretos para la próxima sesión, INCLUYENDO la próxima cita acordada si la hubo, con día y hora (ej: 'próxima cita: jueves a las 12:00'). Lista vacía si no se acordó nada."],
  "therapeutic_progress": "Una oración describiendo el estado de la relación terapéutica al final de esta sesión."
}` }],
    "Eres un asistente que genera resúmenes compactos de sesiones terapéuticas desde una perspectiva observacional neutral. Solo JSON.",
    { jsonMode: true },
  );

  try {
    const cleaned = summaryResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    await admin.from("session_summaries").upsert({
      conversation_id: conversationId,
      student_id: studentId,
      ai_patient_id: patientId,
      session_number: conv?.session_number || 1,
      summary: parsed.summary,
      key_revelations: parsed.key_revelations || [],
      commitments: parsed.commitments || [],
      therapeutic_progress: parsed.therapeutic_progress || "",
      final_clinical_state: finalState || null,
    }, { onConflict: "conversation_id" });
  } catch {
    // No crítico — la sesión funciona sin resumen.
  }
}

/** Avisa (in-app + correo a docentes de la sección) que la sesión ya está evaluada. */
export async function notifyInstructors(
  admin: Admin,
  studentId: string,
  aiPatientId: string | null,
  conversationId: string,
): Promise<boolean> {
  const { data: student } = await admin
    .from("profiles")
    .select("full_name, establishment_id, section_id, course_id")
    .eq("id", studentId)
    .single();
  if (!student?.establishment_id) return false;

  const { data: insts } = await admin
    .from("profiles")
    .select("id, email, role, section_id, course_id")
    .eq("establishment_id", student.establishment_id)
    .in("role", ["instructor", "admin", "superadmin"]);

  const recipients = (insts || []).filter(
    (i) => i.id !== studentId && canViewStudent(
      { role: i.role, sectionId: i.section_id, courseId: i.course_id },
      { section_id: student.section_id, course_id: student.course_id },
    ),
  );
  if (recipients.length === 0) return false;

  const { data: patient } = aiPatientId
    ? await admin.from("ai_patients").select("name").eq("id", aiPatientId).maybeSingle()
    : { data: null };
  const pname = patient?.name || "paciente";

  await admin.from("notifications").insert(recipients.map((r) => ({
    user_id: r.id,
    type: "pending_review",
    title: "Sesión pendiente de revisión",
    body: `${student.full_name || "Un estudiante"} tuvo una sesión con ${pname} y ya está evaluada por la IA, lista para tu revisión.`,
    href: `/docente/sesion/${conversationId}`,
    is_read: false,
  })));

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new (await import("resend")).Resend(resendKey);
    const emails = recipients.filter((r) => r.role === "instructor" && r.email).map((r) => r.email as string);
    const subject = `Sesión pendiente de revisión — ${student.full_name || "Estudiante"}`;
    const html = `<div style="font-family:sans-serif;max-width:500px;"><h2 style="color:#4A55A2;">Sesión por revisar</h2><p><strong>${student.full_name || "Un estudiante"}</strong> tuvo una sesión con <strong>${pname}</strong>, ya evaluada por la IA. Ingresa a GlorIA para revisarla y enviar tu retroalimentación.</p></div>`;
    for (const email of emails) {
      try { await resend.emails.send({ from: "GlorIA <noreply@glor-ia.com>", to: email, subject, html }); await logEmail("pending_review", email, true); }
      catch { await logEmail("pending_review", email, false); }
    }
  }
  return true;
}

/**
 * Evalúa una conversación de punta a punta: evaluación IA + resumen + (opcional)
 * aviso al docente. Idempotente (upsert por conversation_id). Loguea el error
 * REAL del evaluador (antes se tragaba en silencio) para diagnosticar fallas.
 *
 * NOTA: no verifica si ya existe una evaluación — es responsabilidad del caller
 * (el cron solo pasa sesiones sin eval; el botón de re-eval sí quiere sobrescribir).
 */
export async function evaluateConversation(
  admin: Admin,
  conversationId: string,
  opts?: { notify?: boolean },
): Promise<{ status: "ok" | "skipped" | "error"; overall?: number; error?: string }> {
  const { data: conv } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, session_number")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { status: "skipped", error: "not_found" };

  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (!messages || messages.length < 2) return { status: "skipped", error: "too_short" };

  const transcript = messages
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n\n");

  let evaluation;
  try {
    const response = await chat(
      [{ role: "user", content: buildUserMessage(transcript, { sessionNumber: conv.session_number }) }],
      EVALUATION_PROMPT,
      { jsonMode: true },
    );
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    evaluation = normalizeEvaluation(JSON.parse(jsonStr));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[eval] fallo del evaluador LLM:", { conversationId, error: msg });
    return { status: "error", error: msg };
  }

  await admin.from("session_competencies").upsert(
    buildCompetencyUpsert(evaluation, { conversationId, studentId: conv.student_id, model: activeModelLabel() }),
    { onConflict: "conversation_id" },
  );

  // Resumen para memoria multi-sesión (no crítico si falla).
  await generateSessionSummary(admin, conversationId, conv.student_id, conv.ai_patient_id, transcript).catch(() => {});

  if (opts?.notify) {
    await notifyInstructors(admin, conv.student_id, conv.ai_patient_id, conversationId).catch(() => {});
  }

  return { status: "ok", overall: evaluation.overall_score_v2 };
}
