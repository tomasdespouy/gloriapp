import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, status, comment } = await request.json();
  if (!id || !["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "id y status (accepted/rejected) requeridos" }, { status: 400 });
  }

  const { error } = await supabase
    .from("action_items")
    .update({
      status,
      student_comment: comment || null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("student_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get the conversation_id for this action item
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("action_items")
    .select("conversation_id")
    .eq("id", id)
    .single();

  if (!item?.conversation_id) return NextResponse.json({ success: true });

  // Check if ALL action items for this conversation have been responded to
  const { data: allItems } = await admin
    .from("action_items")
    .select("status")
    .eq("conversation_id", item.conversation_id);

  const allResponded = allItems && allItems.length > 0 &&
    allItems.every((ai) => ai.status === "accepted" || ai.status === "rejected");

  if (allResponded) {
    // Check current feedback_status — only transition from 'approved'
    const { data: comp } = await admin
      .from("session_competencies")
      .select("feedback_status, approved_by")
      .eq("conversation_id", item.conversation_id)
      .single();

    if (comp?.feedback_status === "approved") {
      // Transition to evaluated
      await admin
        .from("session_competencies")
        .update({
          feedback_status: "evaluated",
          evaluated_at: new Date().toISOString(),
        })
        .eq("conversation_id", item.conversation_id);

      // Notify teacher
      if (comp.approved_by) {
        const { data: conversation } = await admin
          .from("conversations")
          .select("student_id, ai_patients(name)")
          .eq("id", item.conversation_id)
          .single();

        const { data: student } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const patientName = (conversation?.ai_patients as unknown as { name: string })?.name || "paciente";

        await admin.from("notifications").insert({
          user_id: comp.approved_by,
          type: "feedback_acknowledged",
          title: "Acuerdos confirmados",
          body: `${student?.full_name || "Estudiante"} respondió todos los acuerdos de su sesión con ${patientName}.`,
          href: `/docente/sesion/${item.conversation_id}`,
        });

        // Send email to teacher
        if (process.env.RESEND_API_KEY) {
          try {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);

            const { data: teacherProfile } = await admin
              .from("profiles")
              .select("email")
              .eq("id", comp.approved_by)
              .single();

            if (teacherProfile?.email) {
              await resend.emails.send({
                from: "GlorIA <noreply@glor-ia.com>",
                to: teacherProfile.email,
                subject: `Acuerdos confirmados — ${student?.full_name || "Estudiante"}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 500px;">
                    <h2 style="color: #4A55A2;">Ciclo de evaluación completado</h2>
                    <p><strong>${student?.full_name || "Un estudiante"}</strong> respondió todos los acuerdos de su sesión con <strong>${patientName}</strong>.</p>
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
    }
  }

  return NextResponse.json({ success: true, all_responded: allResponded });
}
