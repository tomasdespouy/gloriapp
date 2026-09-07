import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logEmail } from "@/lib/email-log";
import { requireCron } from "@/lib/cron-auth";
import { countMessagesByConversation } from "@/lib/message-counts";
import { unclosedSessionHtml, unclosedSessionSubject } from "@/lib/emails/unclosed-session";
import { getGloriaLogoUrl } from "@/lib/email-assets";
import { getAppUrl } from "@/lib/app-url";

/**
 * CRON: le avisa al ESTUDIANTE que dejó una sesión sin cerrar.
 *
 * El docente ya se entera (lo hace cleanup-sessions al abandonarla), pero el
 * estudiante no se enteraba de nada: se iba creyendo que había terminado y su
 * retroalimentación nunca llegaba. Este cron cierra ese hueco.
 *
 * La secuencia completa: el alumno cierra la pestaña → a los 5 min
 * cleanup-sessions marca la conversación "abandoned" → una hora después de eso,
 * si sigue sin evaluar, este cron le escribe una vez.
 *
 * Tres filtros que no son caprichos:
 *
 * - MIN_AGE (1 h): lo que pidió el negocio, y además evita escribirle a alguien
 *   que se fue a almorzar y volvió. Con menos margen el correo llegaría mientras
 *   la persona todavía está trabajando en la sesión.
 *
 * - MAX_AGE (48 h): el freno de mano. Sin él, la PRIMERA corrida en producción
 *   le escribiría a todo el historial de la plataforma de una vez — cientos de
 *   correos por sesiones de hace meses que a nadie le sirve retomar. Con el
 *   tope, el cron solo atiende lo reciente; los rezagos viejos se mandan a
 *   propósito con scripts/recordar-sesiones-sin-cerrar.js.
 *
 * - MIN_MSGS (6): el mismo umbral con que cleanup-sessions decide avisarle al
 *   docente. Una conversación de dos mensajes no vale un correo.
 */

const MIN_AGE_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MIN_MSGS = 6;
const MAX_PER_RUN = 100;

export async function GET(request: Request) {
  const rejected = requireCron(request);
  if (rejected) return rejected;

  const admin = createAdminClient();
  const now = Date.now();
  const desde = new Date(now - MAX_AGE_MS).toISOString();
  const hasta = new Date(now - MIN_AGE_MS).toISOString();

  const { data: candidatas, error } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, created_at, ended_at")
    .eq("status", "abandoned")
    .is("student_reminder_sent_at", null)
    .gte("ended_at", desde)
    .lte("ended_at", hasta)
    .order("ended_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!candidatas?.length) {
    return NextResponse.json({ avisados: 0, message: "Sin sesiones que recordar" });
  }

  const ids = candidatas.map((c) => c.id);

  // Ya evaluada = el alumno volvió y la cerró por su cuenta, o el docente la
  // reevaluó. En cualquier caso ya no corresponde el recordatorio.
  const { data: evaluadas } = await admin
    .from("session_competencies")
    .select("conversation_id")
    .in("conversation_id", ids);
  const yaEvaluada = new Set((evaluadas || []).map((x) => x.conversation_id));

  // Paginado obligatorio: un .in() pelado se corta en 1000 filas sin avisar,
  // y acá un conteo bajo por error marcaría la sesión como atendida para
  // siempre. Si el conteo falla, se corta la corrida sin marcar nada.
  let cuenta: Map<string, number>;
  try {
    cuenta = await countMessagesByConversation(admin, ids);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error contando mensajes" },
      { status: 500 },
    );
  }

  const reales = candidatas.filter(
    (c) => !yaEvaluada.has(c.id) && (cuenta.get(c.id) || 0) >= MIN_MSGS,
  );

  // Las descartadas también se marcan: no hay que volver a mirarlas nunca más.
  const descartadas = candidatas.filter((c) => !reales.includes(c)).map((c) => c.id);
  if (descartadas.length) {
    await admin
      .from("conversations")
      .update({ student_reminder_sent_at: new Date().toISOString() })
      .in("id", descartadas);
  }

  if (!reales.length) {
    return NextResponse.json({ avisados: 0, descartadas: descartadas.length });
  }

  const studentIds = [...new Set(reales.map((c) => c.student_id))];
  const patientIds = [...new Set(reales.map((c) => c.ai_patient_id).filter((x): x is string => !!x))];
  const [{ data: students }, { data: patients }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, is_disabled").in("id", studentIds),
    patientIds.length
      ? admin.from("ai_patients").select("id, name").in("id", patientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const alumno = new Map((students || []).map((s) => [s.id, s]));
  const paciente = new Map((patients || []).map((p) => [p.id, p.name]));

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  // La plantilla no importa nada (así la puede cargar el script de envío
  // puntual), por eso el dominio y el logo se resuelven acá.
  const appUrl = getAppUrl();
  const logoUrl = getGloriaLogoUrl();

  let avisados = 0;
  let fallidos = 0;

  for (const c of reales) {
    const a = alumno.get(c.student_id);
    // Cuenta desactivada o sin correo: se marca igual para no reintentar.
    if (!a?.email || a.is_disabled) {
      await admin
        .from("conversations")
        .update({ student_reminder_sent_at: new Date().toISOString() })
        .eq("id", c.id);
      continue;
    }

    const nombrePaciente = paciente.get(c.ai_patient_id || "") || "tu paciente";
    const html = unclosedSessionHtml({
      studentName: a.full_name || "",
      patientName: nombrePaciente,
      sessionDate: c.created_at,
      messageCount: cuenta.get(c.id) || 0,
      appUrl,
      logoUrl,
    });

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          // Si el cron se solapa consigo mismo, Resend deduplica en vez de
          // mandar el correo dos veces.
          "Idempotency-Key": `unclosed-session-${c.id}`,
        },
        body: JSON.stringify({
          from: "GlorIA <noreply@glor-ia.com>",
          to: a.email,
          subject: unclosedSessionSubject(nombrePaciente),
          html,
        }),
      });

      if (!res.ok) {
        fallidos++;
        await logEmail("unclosed_session", a.email, false, {
          userId: a.id,
          errorCode: String(res.status),
        });
        // Sin marcar: se reintenta en la próxima corrida, mientras siga
        // dentro de la ventana de 48 h.
        continue;
      }

      const body = await res.json().catch(() => null);
      await admin
        .from("conversations")
        .update({ student_reminder_sent_at: new Date().toISOString() })
        .eq("id", c.id);
      await logEmail("unclosed_session", a.email, true, {
        userId: a.id,
        providerMessageId: body?.id ?? null,
      });
      avisados++;
    } catch {
      fallidos++;
      await logEmail("unclosed_session", a.email, false, { userId: a.id });
    }
  }

  return NextResponse.json({
    avisados,
    fallidos,
    descartadas: descartadas.length,
    message: `Recordatorio enviado a ${avisados} estudiantes`,
  });
}
