import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

// Re-dispara la evaluación de IA de una conversación y avisa al docente de la
// sección. Pensado para sesiones reales que quedaron sin evaluar (p. ej. el
// alumno cerró el navegador sin "cerrar sesión"). Reusa el mismo motor que
// /api/sessions/[id]/complete. Crea session_competencies (feedback_status
// "pending") → entra a la cola de revisión del docente.
//
// Autorización: sesión de superadmin (botón en el panel) O Bearer CRON_SECRET
// (para correr lotes server-to-server).

export async function POST(request: Request) {
  // 1) Autorización
  const authHeader = request.headers.get("authorization");
  const viaSecret = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!viaSecret) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "superadmin") {
      return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = body.conversationId as string | undefined;
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });

  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, session_number")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (!messages || messages.length < 2) {
    return NextResponse.json({ error: "Sesión muy corta para evaluar (sin conversación)" }, { status: 400 });
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "TERAPEUTA" : "PACIENTE"}: ${m.content}`)
    .join("\n\n");

  // 2) Evaluación con IA (mismo motor que /complete)
  let evaluation;
  try {
    const response = await chat(
      [{ role: "user", content: buildUserMessage(transcript, { sessionNumber: conv.session_number }) }],
      EVALUATION_PROMPT,
    );
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    evaluation = normalizeEvaluation(JSON.parse(jsonStr));
  } catch {
    return NextResponse.json({ error: "Error al evaluar la sesión (LLM)" }, { status: 500 });
  }

  await admin.from("session_competencies").upsert(
    buildCompetencyUpsert(evaluation, {
      conversationId,
      studentId: conv.student_id,
      model: activeModelLabel(),
    }),
    { onConflict: "conversation_id" },
  );

  // 3) Avisar al docente de la sección (in-app + correo a instructores)
  const reported = await notifyInstructors(admin, conv.student_id, conv.ai_patient_id, conversationId);

  return NextResponse.json({
    success: true,
    overall_score_v2: evaluation.overall_score_v2,
    reported,
  });
}

async function notifyInstructors(
  admin: ReturnType<typeof createAdminClient>,
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
