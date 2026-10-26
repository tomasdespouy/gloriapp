import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Escala de la nota libre del docente (session_feedback.teacher_score).
 *
 * El campo decía "0 - 10" para todos, pero en Chile las supervisoras ponen
 * notas de 1,0 a 7,0 (CAP UGM, 2º sem 2026) y el estudiante las veía como
 * "4/10". En Colombia hay notas de 8, así que fuera de Chile se mantiene 0-10.
 */
export type TeacherScoreScale = { min: number; max: number; step: number };

export function teacherScoreScale(country: string | null | undefined): TeacherScoreScale {
  return country?.trim().toLowerCase() === "chile"
    ? { min: 1, max: 7, step: 0.1 }
    : { min: 0, max: 10, step: 0.5 };
}

/** Escala según el país del establecimiento del estudiante. */
export async function teacherScoreScaleForStudent(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
): Promise<TeacherScoreScale> {
  const { data: profile } = await admin
    .from("profiles")
    .select("establishment_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!profile?.establishment_id) return teacherScoreScale(null);
  const { data: est } = await admin
    .from("establishments")
    .select("country")
    .eq("id", profile.establishment_id)
    .maybeSingle();
  return teacherScoreScale(est?.country);
}
