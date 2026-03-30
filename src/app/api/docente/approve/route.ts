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

  // Check if session_competencies exists
  const { data: existing } = await admin
    .from("session_competencies")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  if (existing) {
    // Normal path — update existing record
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
  } else {
    // Fallback — AI evaluation never ran; create record so the flow can proceed
    const { error: insertError } = await admin
      .from("session_competencies")
      .insert({
        conversation_id,
        student_id: conversation.student_id,
        feedback_status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        eval_version: 2,
        overall_score_v2: 0,
        overall_score: 0,
        setting_terapeutico: 0,
        motivo_consulta: 0,
        datos_contextuales: 0,
        objetivos: 0,
        escucha_activa: 0,
        actitud_no_valorativa: 0,
        optimismo: 0,
        presencia: 0,
        conducta_no_verbal: 0,
        contencion_afectos: 0,
        empathy: 0,
        active_listening: 0,
        open_questions: 0,
        reformulation: 0,
        confrontation: 0,
        silence_management: 0,
        rapport: 0,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
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
