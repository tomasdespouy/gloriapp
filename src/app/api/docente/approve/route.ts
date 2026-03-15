import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { conversation_id } = await request.json();
  if (!conversation_id) {
    return NextResponse.json({ error: "conversation_id requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get session info
  const { data: conversation } = await admin
    .from("conversations")
    .select("student_id, ai_patients(name)")
    .eq("id", conversation_id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // Mark as approved
  const { error: updateError } = await admin
    .from("session_competencies")
    .update({
      feedback_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversation_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const patientName = (conversation.ai_patients as unknown as { name: string })?.name || "paciente";

  // Create notification for student
  await admin.from("notifications").insert({
    user_id: conversation.student_id,
    type: "feedback_approved",
    title: "Retroalimentación disponible",
    body: `Tu docente revisó y aprobó la retroalimentación de tu sesión con ${patientName}. Ya puedes ver tus resultados.`,
    href: `/review/${conversation_id}`,
  });

  // Send email notification via Resend
  const { data: studentProfile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", conversation.student_id)
    .single();

  if (studentProfile?.email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "GlorIA <onboarding@resend.dev>",
        to: studentProfile.email,
        subject: `Retroalimentación disponible — Sesión con ${patientName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px;">
            <h2 style="color: #4A55A2;">Tu retroalimentación está lista</h2>
            <p>Hola ${studentProfile.full_name?.split(" ")[0] || ""},</p>
            <p>Tu docente ha revisado y aprobado la retroalimentación de tu sesión con <strong>${patientName}</strong>.</p>
            <p>Ingresa a GlorIA para ver tus resultados detallados, incluyendo tus puntajes por competencia y recomendaciones de mejora.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">GlorIA — Plataforma de entrenamiento clínico</p>
          </div>
        `,
      });
    } catch {
      // Email is optional — don't fail the request
    }
  }

  return NextResponse.json({ success: true });
}
