import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "instructor" &&
    profile?.role !== "admin" &&
    profile?.role !== "superadmin"
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const { conversation_id, teacher_comment, teacher_score } = body;

  if (!conversation_id) {
    return NextResponse.json(
      { error: "conversation_id requerido" },
      { status: 400 }
    );
  }

  if (teacher_score != null && (teacher_score < 0 || teacher_score > 10)) {
    return NextResponse.json(
      { error: "teacher_score debe estar entre 0 y 10" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // ── 1. Get conversation info ──
  const { data: conversation } = await admin
    .from("conversations")
    .select("student_id, ai_patients(name)")
    .eq("id", conversation_id)
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 }
    );
  }

  // ── 2. Save teacher feedback (update existing or create new) ──
  const { data: existingFb } = await admin
    .from("session_feedback")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  const fbPayload = {
    teacher_id: user.id,
    teacher_comment: teacher_comment || null,
    teacher_score: teacher_score != null ? teacher_score : null,
  };

  const { error: fbError } = existingFb
    ? await admin
        .from("session_feedback")
        .update(fbPayload)
        .eq("conversation_id", conversation_id)
    : await admin.from("session_feedback").insert({
        ...fbPayload,
        conversation_id,
        student_id: conversation.student_id,
      });

  if (fbError) {
    return NextResponse.json({ error: fbError.message }, { status: 500 });
  }

  // ── 3. Approve: upsert session_competencies ──
  const now = new Date().toISOString();

  const { data: existingComp } = await admin
    .from("session_competencies")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  if (existingComp) {
    const { error: updateErr } = await admin
      .from("session_competencies")
      .update({
        feedback_status: "approved",
        approved_by: user.id,
        approved_at: now,
      })
      .eq("conversation_id", conversation_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  } else {
    // AI evaluation never ran — create skeleton so the flow works
    const { error: insertErr } = await admin
      .from("session_competencies")
      .insert({
        conversation_id,
        student_id: conversation.student_id,
        feedback_status: "approved",
        approved_by: user.id,
        approved_at: now,
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

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  // ── 4. Notify student ──
  const patientName =
    (conversation.ai_patients as unknown as { name: string })?.name ||
    "paciente";

  await admin.from("notifications").insert({
    user_id: conversation.student_id,
    type: "feedback_approved",
    title: "Retroalimentación disponible",
    body: `Tu docente revisó y aprobó la retroalimentación de tu sesión con ${patientName}. Ya puedes ver tus resultados.`,
    href: `/review/${conversation_id}`,
  });

  // ── 5. Email notification ──
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
      // Email is optional
    }
  }

  return NextResponse.json({ success: true });
}
