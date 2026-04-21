import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Student acknowledges teacher feedback → closes the evaluation loop.
 * Sets feedback_status to 'evaluated' for both student and teacher.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // Verify ownership and current status
  const { data: comp } = await admin
    .from("session_competencies")
    .select("feedback_status, approved_by")
    .eq("conversation_id", conversationId)
    .single();

  if (!comp) {
    return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
  }

  if (comp.feedback_status !== "approved") {
    return NextResponse.json({ error: "La sesión debe estar aprobada para confirmar" }, { status: 400 });
  }

  // Verify conversation belongs to student (superadmin can act on behalf)
  const { data: conversation } = await admin
    .from("conversations")
    .select("student_id, ai_patients(name)")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isSuperadmin = callerProfile?.role === "superadmin";

  if (conversation.student_id !== user.id && !isSuperadmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Transition to evaluated
  await admin
    .from("session_competencies")
    .update({
      feedback_status: "evaluated",
      evaluated_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId);

  // Notify teacher who approved
  if (comp.approved_by) {
    const { data: student } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", conversation.student_id)
      .single();

    const patientName = (conversation.ai_patients as unknown as { name: string })?.name || "paciente";

    await admin.from("notifications").insert({
      user_id: comp.approved_by,
      type: "feedback_acknowledged",
      title: "Retroalimentación confirmada",
      body: `${student?.full_name || "Estudiante"} revisó la retroalimentación de su sesión con ${patientName}.`,
      href: `/docente/sesion/${conversationId}`,
    });

    // Send email to teacher
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data: teacherProfile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", comp.approved_by)
          .single();

        if (teacherProfile?.email) {
          await resend.emails.send({
            from: "GlorIA <noreply@glor-ia.com>",
            to: teacherProfile.email,
            subject: `Retroalimentación confirmada — ${student?.full_name || "Estudiante"}`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px;">
                <h2 style="color: #4A55A2;">Ciclo de evaluación completado</h2>
                <p><strong>${student?.full_name || "Un estudiante"}</strong> revisó y confirmó la retroalimentación de su sesión con <strong>${patientName}</strong>.</p>
                <p>La sesión ahora está marcada como <strong>Evaluada</strong> para ambos.</p>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">GlorIA — Plataforma de entrenamiento clínico</p>
              </div>
            `,
          });
        }
      } catch {
        // Email is optional
      }
    }
  }

  return NextResponse.json({ success: true });
}
