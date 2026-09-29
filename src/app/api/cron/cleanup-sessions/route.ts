/**
 * CRON: cierre automático de sesiones inactivas.
 *
 * Marca como "abandoned" (el Paciente IA cierra) las conversaciones activas
 * cuyo alumno lleva >5 min sin presencia. Usamos `profiles.last_seen_at` (el
 * latido cada 60s mientras la pestaña está visible): si el alumno sigue en la
 * sesión leyendo, late y NO se cierra; si cerró/cambió de pestaña, deja de
 * latir y a los 5 min se abandona. Da gracia desde `created_at` para sesiones
 * recién creadas.
 *
 * Pensado para correr cada ~5 min. Hoy lo dispara un cron EXTERNO
 * (cron-job.org) con el header `Authorization: Bearer <CRON_SECRET>`, además
 * del cron nativo diario declarado en vercel.json.
 *
 * NOTA: el proyecto está en plan Vercel Pro (crons nativos ilimitados, con
 * granularidad de minutos), así que este disparo externo ya no es obligatorio.
 * Migrarlo es un cambio aparte: hay que apagar el externo en la misma ventana
 * para no duplicar corridas.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { canViewStudent } from "@/lib/section-scope";
import { logEmail } from "@/lib/email-log";
import { requireCron } from "@/lib/cron-auth";
import { isBusinessHours } from "@/lib/business-hours";

const INACTIVITY_MS = 5 * 60 * 1000;
const MIN_MSGS_REPORT = 6; // conversación "real" digna de reporte al docente
// El correo se difiere a horario hábil (abajo); 4 días le da margen de sobra
// para que una tanda de abandonos del viernes a la noche siga alcanzable el
// lunes, sin que la consulta de "pendientes de avisar" crezca sin límite.
const EMAIL_BACKLOG_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const rejected = requireCron(request);
  if (rejected) return rejected;
  const admin = createAdminClient();

  const { data: active, error: fetchError } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, created_at")
    .eq("status", "active");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!active || active.length === 0) {
    return NextResponse.json({ abandoned: 0, message: "Sin sesiones activas" });
  }

  // Presencia de los alumnos con sesión activa (lista chica → .in seguro).
  const studentIds = [...new Set(active.map((c) => c.student_id).filter(Boolean))];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, last_seen_at")
    .in("id", studentIds);
  const lastSeen = new Map((profs || []).map((p) => [p.id, p.last_seen_at as string | null]));

  const cutoff = Date.now() - INACTIVITY_MS;
  const stale = active.filter((c) => {
    const ls = lastSeen.get(c.student_id);
    const seenTs = ls ? Date.parse(ls) : 0;
    const createdTs = Date.parse(c.created_at);
    // Última señal de vida = lo más reciente entre presencia y creación.
    return Math.max(seenTs, createdTs) < cutoff;
  });
  const staleIds = stale.map((c) => c.id);

  if (staleIds.length === 0) {
    return NextResponse.json({ abandoned: 0, message: "Ninguna inactiva >5 min" });
  }

  const { error: updateError } = await admin
    .from("conversations")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .in("id", staleIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notificación EN LA APP: inmediata, sin importar la hora — no es un correo
  // que interrumpa a nadie, es una campanita que espera a que la revisen.
  const notified = await notifyStaleInApp(admin, stale);

  // Correo al docente: se difiere a horario hábil. Va por consulta aparte
  // (no por el array `stale` de esta corrida): así, si esta corrida cae de
  // madrugada, la de la mañana igual encuentra estas conversaciones por
  // instructor_notified_at IS NULL — no dependen de seguir siendo "active".
  const emailed = isBusinessHours() ? await emailPendingReviewBacklog(admin) : 0;

  return NextResponse.json({
    abandoned: staleIds.length,
    notified,
    emailed,
    message: `Abandonadas ${staleIds.length} sesiones; notificadas en la app ${notified}; correo enviado a docente ${emailed}`,
  });
}

type StaleConv = { id: string; student_id: string; ai_patient_id: string | null; created_at: string };

/** Recipiente docente habilitado a ver a este alumno, para una conversación real (≥MIN_MSGS_REPORT). */
async function resolveRecipients(
  admin: ReturnType<typeof createAdminClient>,
  real: { id: string; student_id: string; ai_patient_id: string | null }[],
) {
  const studentIds = [...new Set(real.map((c) => c.student_id))];
  const patientIds = [...new Set(real.map((c) => c.ai_patient_id).filter((x): x is string => !!x))];
  const [{ data: students }, { data: patients }] = await Promise.all([
    admin.from("profiles").select("id, full_name, establishment_id, section_id, course_id").in("id", studentIds),
    patientIds.length ? admin.from("ai_patients").select("id, name").in("id", patientIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const studentMap = new Map((students || []).map((s) => [s.id, s]));
  const patientName = new Map((patients || []).map((p) => [p.id, p.name]));
  const instByEst = new Map<string, { id: string; email: string | null; role: string; section_id: string | null; course_id: string | null }[]>();

  return { studentMap, patientName, instByEst };
}

/**
 * Notificación EN LA APP (campanita), inmediata — no es un correo, no hay
 * motivo para diferirla a horario hábil.
 */
async function notifyStaleInApp(
  admin: ReturnType<typeof createAdminClient>,
  stale: StaleConv[],
): Promise<number> {
  if (stale.length === 0) return 0;

  const ids = stale.map((c) => c.id);
  const { data: msgs } = await admin.from("messages").select("conversation_id").in("conversation_id", ids);
  const counts = new Map<string, number>();
  for (const m of msgs || []) counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
  const real = stale.filter((c) => (counts.get(c.id) || 0) >= MIN_MSGS_REPORT);
  if (real.length === 0) return 0;

  const { studentMap, patientName, instByEst } = await resolveRecipients(admin, real);
  let notified = 0;

  for (const c of real) {
    const student = studentMap.get(c.student_id);
    if (!student?.establishment_id) continue;

    if (!instByEst.has(student.establishment_id)) {
      const { data: insts } = await admin
        .from("profiles")
        .select("id, email, role, section_id, course_id")
        .eq("establishment_id", student.establishment_id)
        .in("role", ["instructor", "admin", "superadmin"]);
      instByEst.set(student.establishment_id, insts || []);
    }
    const recipients = (instByEst.get(student.establishment_id) || []).filter(
      (i) => i.id !== student.id && canViewStudent(
        { role: i.role, sectionId: i.section_id, courseId: i.course_id },
        { section_id: student.section_id, course_id: student.course_id },
      ),
    );
    if (recipients.length === 0) continue;

    const pname = patientName.get(c.ai_patient_id || "") || "paciente";
    await admin.from("notifications").insert(recipients.map((r) => ({
      user_id: r.id,
      type: "pending_review",
      title: "Sesión sin cerrar — pendiente de revisión",
      body: `${student.full_name || "Un estudiante"} tuvo una sesión con ${pname} pero cerró el navegador sin cerrarla. Puedes revisarla y evaluarla.`,
      href: `/docente/sesion/${c.id}`,
      is_read: false,
    })));
    notified++;
  }
  return notified;
}

/**
 * Correo al docente: SOLO en horario hábil (el caller ya lo chequeó). Busca
 * por consulta propia (status='abandoned' AND instructor_notified_at IS
 * NULL), no por el `stale` de la corrida que detectó el abandono — así una
 * tanda abandonada de madrugada la agarra la primera corrida en horario
 * hábil, en vez de perderse porque la conversación ya no es 'active'.
 */
async function emailPendingReviewBacklog(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const desde = new Date(Date.now() - EMAIL_BACKLOG_MAX_AGE_MS).toISOString();
  const { data: pendientes } = await admin
    .from("conversations")
    .select("id, student_id, ai_patient_id, created_at")
    .eq("status", "abandoned")
    .is("instructor_notified_at", null)
    .gte("ended_at", desde)
    .limit(100);
  if (!pendientes?.length) return 0;

  const ids = pendientes.map((c) => c.id);
  const { data: msgs } = await admin.from("messages").select("conversation_id").in("conversation_id", ids);
  const counts = new Map<string, number>();
  for (const m of msgs || []) counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
  const real = pendientes.filter((c) => (counts.get(c.id) || 0) >= MIN_MSGS_REPORT);

  // Las descartadas (poca conversación) también se marcan: si no, la
  // consulta de arriba las vuelve a traer para siempre.
  const descartadas = pendientes.filter((c) => !real.some((r) => r.id === c.id)).map((c) => c.id);
  if (descartadas.length) {
    await admin.from("conversations").update({ instructor_notified_at: new Date().toISOString() }).in("id", descartadas);
  }
  if (real.length === 0) return 0;

  const { studentMap, patientName, instByEst } = await resolveRecipients(admin, real);
  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new (await import("resend")).Resend(resendKey) : null;
  const appUrl = (await import("@/lib/app-url")).getAppUrl();
  let reported = 0;

  for (const c of real) {
    const student = studentMap.get(c.student_id);
    if (!student?.establishment_id) {
      await admin.from("conversations").update({ instructor_notified_at: new Date().toISOString() }).eq("id", c.id);
      continue;
    }

    if (!instByEst.has(student.establishment_id)) {
      const { data: insts } = await admin
        .from("profiles")
        .select("id, email, role, section_id, course_id")
        .eq("establishment_id", student.establishment_id)
        .in("role", ["instructor", "admin", "superadmin"]);
      instByEst.set(student.establishment_id, insts || []);
    }
    const recipients = (instByEst.get(student.establishment_id) || []).filter(
      (i) => i.id !== student.id && canViewStudent(
        { role: i.role, sectionId: i.section_id, courseId: i.course_id },
        { section_id: student.section_id, course_id: student.course_id },
      ),
    );

    const pname = patientName.get(c.ai_patient_id || "") || "paciente";

    // Correo solo a docentes (instructor), individual, con link directo al caso.
    if (resend) {
      const emails = recipients.filter((r) => r.role === "instructor" && r.email).map((r) => r.email as string);
      const subject = `Sesión sin cerrar — ${student.full_name || "Estudiante"}`;
      const caseUrl = `${appUrl}/docente/sesion/${c.id}`;
      const html = `<div style="font-family:sans-serif;max-width:500px;"><h2 style="color:#4A55A2;">Sesión por revisar</h2><p><strong>${student.full_name || "Un estudiante"}</strong> tuvo una sesión con <strong>${pname}</strong> pero cerró el navegador sin cerrarla formalmente. La conversación quedó registrada; puedes revisarla y enviar tu retroalimentación (la sesión no tiene autorreflexión del estudiante).</p><p><a href="${caseUrl}" style="color:#4A55A2;">Ir directo a esta sesión</a></p></div>`;
      for (const email of emails) {
        try { await resend.emails.send({ from: "GlorIA <noreply@glor-ia.com>", to: email, subject, html }); await logEmail("pending_review", email, true); }
        catch { await logEmail("pending_review", email, false); }
      }
    }
    await admin.from("conversations").update({ instructor_notified_at: new Date().toISOString() }).eq("id", c.id);
    reported++;
  }
  return reported;
}
