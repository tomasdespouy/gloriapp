import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Duración mínima esperada de una entrevista, resuelta para un estudiante.
 *
 * Vive en la asignatura (courses.min_session_minutes), no en el
 * establecimiento: la expectativa es pedagógica. UPC dicta "Psicopatología del
 * Adulto" y "Práctica Profesional I" al mismo tiempo, y no tienen por qué
 * pedir la misma duración.
 *
 * El perfil del alumno trae course_id, pero no siempre: hay cuentas cargadas
 * solo con sección. Por eso, si falta, se sube por sections.course_id antes de
 * rendirse.
 *
 * Devuelve null cuando no hay expectativa configurada, que es el caso de casi
 * todas las asignaturas. null significa "no avisar nada", nunca "cero minutos".
 */
export async function getMinSessionMinutes(studentId: string): Promise<number | null> {
  if (!studentId) return null;

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
  if (!courseId) return null;

  const { data: course, error } = await admin
    .from("courses")
    .select("min_session_minutes")
    .eq("id", courseId)
    .maybeSingle();

  // La columna puede no existir todavía si el código llega antes que su
  // migración. Sin expectativa configurada el chat se comporta como siempre,
  // así que degradar a null es exactamente lo correcto.
  if (error) return null;

  const min = course?.min_session_minutes;
  return typeof min === "number" && min > 0 ? min : null;
}
