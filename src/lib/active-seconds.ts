/**
 * Tope del tiempo activo de una conversación.
 *
 * SessionTimer acumula tiempo de reloj y una pestaña olvidada abierta después
 * de terminar el chat convierte una sesión de 15 minutos en 30 horas. Mientras
 * la raíz siga viva, todo lo que MUESTRE una duración al usuario tiene que
 * pasar por acá: informes de piloto y descarga de la conversación en .docx.
 * Si cada lugar inventa su propio tope, el mismo dato aparece distinto según
 * dónde se lo mire.
 *
 * Tope = min(valor guardado, reloj de pared + 5 min de gracia, 90 min).
 */

const ABSOLUTE_CAP_SECONDS = 5400;
const WALL_CLOCK_GRACE_SECONDS = 300;

export function cappedActiveSeconds(c: {
  active_seconds: number | null;
  started_at?: string | null;
  ended_at?: string | null;
}): number {
  const raw = c.active_seconds;
  if (typeof raw !== "number" || raw <= 0) return 0;
  let cap = ABSOLUTE_CAP_SECONDS;
  if (c.started_at && c.ended_at) {
    const wall = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000;
    if (wall > 0) cap = Math.min(cap, wall + WALL_CLOCK_GRACE_SECONDS);
  }
  return Math.min(raw, cap);
}
