import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logEmail } from "@/lib/email-log";
import { requireCron } from "@/lib/cron-auth";
import { getAppUrl } from "@/lib/app-url";
import { getGloriaLogoUrl } from "@/lib/email-assets";
import { getCertificationPolicy } from "@/lib/certification";
import { formatChileDateTime } from "@/lib/datetime-cl";

/**
 * CRON: recordatorio por correo de una sesión agendada del programa de
 * certificación (toggle certification_email_notifications), 24h antes.
 *
 * Mismo esqueleto que remind-unclosed-sessions: ventana de tiempo + marca
 * reminder_sent_at para no reintentar, idempotency-key para que un solape
 * del cron consigo mismo no duplique el envío en Resend.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 100;

export async function GET(request: Request) {
  const rejected = requireCron(request);
  if (rejected) return rejected;

  const admin = createAdminClient();
  const now = new Date();
  const hasta = new Date(now.getTime() + WINDOW_MS).toISOString();

  const { data: candidatas, error } = await admin
    .from("patient_schedules")
    .select("id, student_id, ai_patient_id, scheduled_at")
    .eq("status", "pendiente")
    .is("reminder_sent_at", null)
    .lte("scheduled_at", hasta)
    .gte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!candidatas?.length) {
    return NextResponse.json({ avisados: 0, message: "Sin sesiones agendadas próximas" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  const appUrl = getAppUrl();
  const logoUrl = getGloriaLogoUrl();

  const studentIds = [...new Set(candidatas.map((c) => c.student_id))];
  const patientIds = [...new Set(candidatas.map((c) => c.ai_patient_id))];
  const [{ data: students }, { data: patients }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, is_disabled").in("id", studentIds),
    admin.from("ai_patients").select("id, name").in("id", patientIds),
  ]);
  const alumno = new Map((students || []).map((s) => [s.id, s]));
  const paciente = new Map((patients || []).map((p) => [p.id, p.name]));

  let avisados = 0;
  let fallidos = 0;
  let sinPrograma = 0;

  for (const c of candidatas) {
    const a = alumno.get(c.student_id);
    if (!a?.email || a.is_disabled) {
      await admin.from("patient_schedules").update({ reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
      continue;
    }

    // Puede que la asignatura haya desactivado el toggle después de agendado.
    const policy = await getCertificationPolicy(c.student_id);
    if (!policy.isCertificationProgram || !policy.emailNotifications) {
      sinPrograma++;
      await admin.from("patient_schedules").update({ reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
      continue;
    }

    const nombrePaciente = paciente.get(c.ai_patient_id) || "tu paciente";
    const fecha = formatChileDateTime(c.scheduled_at);
    const html = `
      <div style="font-family: sans-serif; max-width: 500px;">
        <img src="${logoUrl}" alt="GlorIA" style="height: 32px; margin-bottom: 16px;" />
        <h2 style="color: #4A55A2;">Tu próxima sesión se acerca</h2>
        <p>Hola ${a.full_name || ""}, tu sesión con <strong>${nombrePaciente}</strong> está agendada para el <strong>${fecha}</strong>.</p>
        <p>Ingresa a GlorIA para comenzarla en el horario acordado.</p>
        <p><a href="${appUrl}/pacientes" style="color: #4A55A2;">Ir a mis pacientes</a></p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">GlorIA — Plataforma de entrenamiento clínico</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `scheduled-session-reminder-${c.id}`,
        },
        body: JSON.stringify({
          from: "GlorIA <noreply@glor-ia.com>",
          to: a.email,
          subject: `Tu sesión con ${nombrePaciente} es el ${fecha}`,
          html,
        }),
      });

      if (!res.ok) {
        fallidos++;
        await logEmail("scheduled_session_reminder", a.email, false, { userId: a.id, errorCode: String(res.status) });
        continue;
      }

      const body = await res.json().catch(() => null);
      await admin.from("patient_schedules").update({ reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
      await logEmail("scheduled_session_reminder", a.email, true, { userId: a.id, providerMessageId: body?.id ?? null });
      avisados++;
    } catch {
      fallidos++;
      await logEmail("scheduled_session_reminder", a.email, false, { userId: a.id });
    }
  }

  return NextResponse.json({
    avisados,
    fallidos,
    sinPrograma,
    message: `Recordatorio enviado a ${avisados} estudiantes`,
  });
}
