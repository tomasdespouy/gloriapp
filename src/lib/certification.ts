import { createAdminClient } from "@/lib/supabase/admin";
import { logEmail } from "@/lib/email-log";

/**
 * Política de un "programa de certificación": una asignatura (courses) marcada
 * is_certification_program, con sus toggles y reglas de agenda. Mismo patrón
 * que getMinSessionMinutes en session-expectations.ts — resuelve por
 * course_id del perfil, con fallback a sections.course_id.
 */
export type CertificationPolicy = {
  courseId: string;
  isCertificationProgram: boolean;
  feedbackMode: "auto" | "docente";
  blockPaste: boolean;
  watchTabSwitch: boolean;
  emailNotifications: boolean;
  minHoursBetweenSessions: number;
  maxSessionMinutes: number | null;
  maxSessionMessages: number | null;
  distractionAction: "cut" | "alert_only";
  distractionCutThreshold: number;
};

const DEFAULT_POLICY_NO_COURSE: CertificationPolicy = {
  courseId: "",
  isCertificationProgram: false,
  feedbackMode: "docente",
  blockPaste: false,
  watchTabSwitch: false,
  emailNotifications: false,
  minHoursBetweenSessions: 72,
  maxSessionMinutes: null,
  maxSessionMessages: null,
  distractionAction: "cut",
  distractionCutThreshold: 2,
};

async function resolveCourseId(studentId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("course_id, section_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!profile) return null;

  let courseId = profile.course_id as string | null;
  if (!courseId && profile.section_id) {
    const { data: section } = await admin
      .from("sections")
      .select("course_id")
      .eq("id", profile.section_id)
      .maybeSingle();
    courseId = (section?.course_id as string | null) ?? null;
  }
  return courseId;
}

/**
 * Trae la política de certificación de la asignatura del alumno. Si la
 * asignatura no existe, no está configurada, o la columna todavía no llegó
 * (migración pendiente), degrada al default que reproduce el comportamiento
 * actual de la plataforma (isCertificationProgram: false, corte a 2 eventos).
 */
export async function getCertificationPolicy(studentId: string): Promise<CertificationPolicy> {
  if (!studentId) return DEFAULT_POLICY_NO_COURSE;

  const courseId = await resolveCourseId(studentId);
  if (!courseId) return DEFAULT_POLICY_NO_COURSE;

  const admin = createAdminClient();
  const { data: course, error } = await admin
    .from("courses")
    .select(`
      id,
      is_certification_program,
      certification_feedback_mode,
      certification_block_paste,
      certification_watch_tab_switch,
      certification_email_notifications,
      certification_min_hours_between_sessions,
      max_session_minutes,
      max_session_messages,
      distraction_action,
      distraction_cut_threshold
    `)
    .eq("id", courseId)
    .maybeSingle();

  if (error || !course) return DEFAULT_POLICY_NO_COURSE;

  return {
    courseId,
    isCertificationProgram: !!course.is_certification_program,
    feedbackMode: (course.certification_feedback_mode as "auto" | "docente") || "docente",
    blockPaste: !!course.certification_block_paste,
    watchTabSwitch: !!course.certification_watch_tab_switch,
    emailNotifications: !!course.certification_email_notifications,
    minHoursBetweenSessions: course.certification_min_hours_between_sessions || 72,
    maxSessionMinutes: course.max_session_minutes ?? null,
    maxSessionMessages: course.max_session_messages ?? null,
    distractionAction: (course.distraction_action as "cut" | "alert_only") || "cut",
    distractionCutThreshold: course.distraction_cut_threshold || 2,
  };
}

/** Último fin de sesión del alumno, cruzado entre TODOS sus pacientes. */
export async function getStudentLastSessionEnd(studentId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conversations")
    .select("ended_at")
    .eq("student_id", studentId)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ended_at ?? null;
}

export type PatientLockReason = "not_scheduled" | "not_yet_time" | "cooldown";

export type LockState = {
  locked: boolean;
  reason: PatientLockReason | null;
  /** ISO string de cuándo se desbloquea, si se puede calcular. */
  unlocksAt: string | null;
};

/**
 * Estado de candado de UN paciente para un alumno de programa de certificación.
 * Función pura — se puede llamar tanto en la grilla (solo lectura, define la UI)
 * como en el gate real al crear la conversación (server-side, no bypasseable).
 */
export function computeLockState(params: {
  schedule: { scheduled_at: string; status: string } | null;
  lastSessionEndedAt: string | null;
  minHours: number;
  now?: Date;
}): LockState {
  const { schedule, lastSessionEndedAt, minHours } = params;
  const now = params.now ?? new Date();

  if (!schedule || schedule.status === "cancelada") {
    return { locked: true, reason: "not_scheduled", unlocksAt: null };
  }

  const scheduledAt = new Date(schedule.scheduled_at);
  if (scheduledAt.getTime() > now.getTime()) {
    return { locked: true, reason: "not_yet_time", unlocksAt: schedule.scheduled_at };
  }

  if (lastSessionEndedAt) {
    const cooldownEndsAt = new Date(lastSessionEndedAt).getTime() + minHours * 60 * 60 * 1000;
    if (cooldownEndsAt > now.getTime()) {
      return { locked: true, reason: "cooldown", unlocksAt: new Date(cooldownEndsAt).toISOString() };
    }
  }

  return { locked: false, reason: null, unlocksAt: null };
}

/**
 * Avisa (in-app + correo, si certification_email_notifications está activo)
 * que el feedback quedó disponible sin pasar por revisión docente
 * (certification_feedback_mode = 'auto'). El aviso de aprobación MANUAL del
 * docente (src/app/api/docente/evaluate/route.ts) es un flujo aparte, ya
 * existente y siempre activo — este solo cubre el camino automático nuevo.
 */
export async function notifyAutoApprovedFeedback(
  studentId: string,
  aiPatientId: string | null,
  conversationId: string,
): Promise<void> {
  const policy = await getCertificationPolicy(studentId);
  if (!policy.emailNotifications) return;

  const admin = createAdminClient();
  const [{ data: student }, { data: patient }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", studentId).maybeSingle(),
    aiPatientId
      ? admin.from("ai_patients").select("name").eq("id", aiPatientId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const patientName = patient?.name || "paciente";

  await admin.from("notifications").insert({
    user_id: studentId,
    type: "feedback_approved",
    title: "Retroalimentación disponible",
    body: `Ya está lista la retroalimentación de tu sesión con ${patientName}.`,
    href: `/review/${conversationId}`,
  }).then(undefined, () => {});

  if (!student?.email || !process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "GlorIA <noreply@glor-ia.com>",
      to: student.email,
      subject: `Retroalimentación disponible — Sesión con ${patientName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #4A55A2;">Tu retroalimentación está lista</h2>
          <p>Hola ${student.full_name?.split(" ")[0] || ""},</p>
          <p>Ya está disponible la retroalimentación de tu sesión con <strong>${patientName}</strong>.</p>
          <p>Ingresa a GlorIA para ver tus resultados detallados.</p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">GlorIA — Plataforma de entrenamiento clínico</p>
        </div>
      `,
    });
    await logEmail("feedback_auto", student.email, true, { userId: studentId });
  } catch {
    await logEmail("feedback_auto", student.email, false, { userId: studentId });
  }
}
