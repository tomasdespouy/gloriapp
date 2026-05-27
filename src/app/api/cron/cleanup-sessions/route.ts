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
 * Pensado para correr cada ~5 min. En Vercel Hobby el cron interno solo corre
 * 1 vez al día (sirve de respaldo); el disparo frecuente se hace con un cron
 * externo (p. ej. cron-job.org) pegando a este endpoint con el header
 * `Authorization: Bearer <CRON_SECRET>`.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { canViewStudent } from "@/lib/section-scope";
import { logEmail } from "@/lib/email-log";

const INACTIVITY_MS = 5 * 60 * 1000;
const MIN_MSGS_REPORT = 6; // conversación "real" digna de reporte al docente

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Reporte al docente: aunque el alumno no haya cerrado ni reflexionado, si la
  // conversación fue real (≥6 mensajes) avisamos al docente de su sección para
  // que pueda revisarla y evaluarla (le aparecerá sin autorreflexión).
  const reported = await reportStaleToInstructors(admin, stale);

  return NextResponse.json({
    abandoned: staleIds.length,
    reported,
    message: `Abandonadas ${staleIds.length} sesiones; reportadas al docente ${reported}`,
  });
}

type StaleConv = { id: string; student_id: string; ai_patient_id: string | null; created_at: string };

async function reportStaleToInstructors(
  admin: ReturnType<typeof createAdminClient>,
  stale: StaleConv[],
): Promise<number> {
  if (stale.length === 0) return 0;

  // Conteo de mensajes por conversación (lista chica).
  const ids = stale.map((c) => c.id);
  const { data: msgs } = await admin.from("messages").select("conversation_id").in("conversation_id", ids);
  const counts = new Map<string, number>();
  for (const m of msgs || []) counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
  const real = stale.filter((c) => (counts.get(c.id) || 0) >= MIN_MSGS_REPORT);
  if (real.length === 0) return 0;

  const studentIds = [...new Set(real.map((c) => c.student_id))];
  const patientIds = [...new Set(real.map((c) => c.ai_patient_id).filter((x): x is string => !!x))];
  const [{ data: students }, { data: patients }] = await Promise.all([
    admin.from("profiles").select("id, full_name, establishment_id, section_id, course_id").in("id", studentIds),
    patientIds.length ? admin.from("ai_patients").select("id, name").in("id", patientIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const studentMap = new Map((students || []).map((s) => [s.id, s]));
  const patientName = new Map((patients || []).map((p) => [p.id, p.name]));

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new (await import("resend")).Resend(resendKey) : null;

  const instByEst = new Map<string, { id: string; email: string | null; role: string; section_id: string | null; course_id: string | null }[]>();
  let reported = 0;

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

    // Correo solo a docentes (instructor), individual.
    if (resend) {
      const emails = recipients.filter((r) => r.role === "instructor" && r.email).map((r) => r.email as string);
      const subject = `Sesión sin cerrar — ${student.full_name || "Estudiante"}`;
      const html = `<div style="font-family:sans-serif;max-width:500px;"><h2 style="color:#4A55A2;">Sesión por revisar</h2><p><strong>${student.full_name || "Un estudiante"}</strong> tuvo una sesión con <strong>${pname}</strong> pero cerró el navegador sin cerrarla formalmente. La conversación quedó registrada; puedes revisarla y enviar tu retroalimentación (la sesión no tiene autorreflexión del estudiante).</p></div>`;
      for (const email of emails) {
        try { await resend.emails.send({ from: "GlorIA <noreply@glor-ia.com>", to: email, subject, html }); await logEmail("pending_review", email, true); }
        catch { await logEmail("pending_review", email, false); }
      }
    }
    reported++;
  }
  return reported;
}
