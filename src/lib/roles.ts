/**
 * Quién puede ver la etiqueta de dificultad del paciente
 * (Principiante / Intermedio / Avanzado).
 *
 * Por decisión de producto (2026-06-25) la dificultad se oculta a estudiantes
 * y docentes —para no sesgar la práctica ni la evaluación— y solo queda visible
 * para la operación (admin y superadmin).
 */
export function canSeeDifficulty(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}
