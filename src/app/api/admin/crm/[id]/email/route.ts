import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Rate limit: 20 emails/hour global
  const rateLimited = await checkRateLimit(emailLimiter, "global");
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const body = await request.json();

  // Get university info
  const { data: university } = await supabase
    .from("crm_universities")
    .select("*")
    .eq("id", id)
    .single();

  if (!university) return NextResponse.json({ error: "Universidad no encontrada" }, { status: 404 });

  const recipientEmail = body.to || university.contact_email;
  if (!recipientEmail) {
    return NextResponse.json({ error: "No hay email de contacto" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  const subject = body.subject || `GlorIA — Plataforma de simulación clínica para ${university.name}`;
  const htmlBody = body.html || generateDefaultEmail(university);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: body.from || "GlorIA <info@gloria-app.cl>",
      to: recipientEmail,
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return NextResponse.json({ error: "Error al enviar email" }, { status: 502 });
  }

  // Log as CRM activity
  await supabase.from("crm_activities").insert({
    university_id: id,
    type: "email",
    description: `Email enviado a ${recipientEmail}: "${subject}"`,
    created_by: user.id,
  });

  // Update status if still "prospecto"
  if (university.status === "prospecto") {
    await supabase
      .from("crm_universities")
      .update({ status: "contactado", updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  const responseData = await res.json();
  return NextResponse.json({ ok: true, emailId: responseData.id });
}

function generateDefaultEmail(university: {
  name: string;
  contact_name: string | null;
  program_name: string;
  country: string;
}) {
  const greeting = university.contact_name
    ? `Estimado/a ${university.contact_name}`
    : "Estimado/a Director/a de Carrera";

  return `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <div style="padding: 24px 0; border-bottom: 3px solid #4A55A2;">
        <img src="https://ndwmnxlwbfqfwwtekjun.supabase.co/storage/v1/object/public/patients/gloria-logo-email.png" alt="GlorIA" style="height: 40px;" />
      </div>

      <div style="padding: 32px 0;">
        <p>${greeting},</p>

        <p>Nos dirigimos a usted desde la <strong>Universidad Gabriela Mistral</strong> para presentarle
        <strong>GlorIA</strong>, una plataforma innovadora de simulación terapéutica basada en
        inteligencia artificial, diseñada específicamente para fortalecer la formación clínica en
        programas de Psicología.</p>

        <h3 style="color: #4A55A2;">¿Qué es GlorIA?</h3>
        <ul>
          <li>Pacientes virtuales con perfiles clínicos multidimensionales y memoria entre sesiones</li>
          <li>Motor adaptativo que responde de forma realista a las intervenciones del estudiante</li>
          <li>Evaluación automática de 10 competencias clínicas con retroalimentación detallada</li>
          <li>Contextualización lingüística y cultural para 12 países latinoamericanos</li>
          <li>Panel docente para supervisión y seguimiento de progreso</li>
        </ul>

        <h3 style="color: #4A55A2;">Resultados validados</h3>
        <p>En nuestro piloto con 48 estudiantes de Psicología, GlorIA demostró mejoras
        estadísticamente significativas (p&lt;0.05) en todas las dimensiones de competencias
        clínicas evaluadas, incluyendo vínculo terapéutico, manejo de entrevista y
        evaluación diagnóstica.</p>

        <p>Nos encantaría coordinar una demostración personalizada para el programa de
        <strong>${university.program_name}</strong> de ${university.name}.</p>

        <p>Quedamos atentos a su respuesta.</p>

        <p>Cordialmente,<br/>
        <strong>Equipo GlorIA</strong><br/>
        Universidad Gabriela Mistral<br/>
        gloria-app.cl</p>
      </div>

      <div style="border-top: 1px solid #E5E5E5; padding: 16px 0; font-size: 12px; color: #9CA3AF;">
        Este correo fue enviado desde la plataforma GlorIA. Si no desea recibir más comunicaciones,
        responda a este email indicándolo.
      </div>
    </div>
  `;
}
