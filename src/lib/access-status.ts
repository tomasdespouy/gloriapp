/**
 * Por qué una cuenta NO puede entrar a la plataforma.
 *
 * Espeja las tres puertas de `src/app/(app)/layout.tsx` — ESA es la autoridad;
 * esto solo las traduce a algo mostrable en el panel de administración. Si allá
 * cambia una regla, hay que actualizar acá (hoy no hay forma de que el layout
 * reuse esto: sus puertas son `redirect()` con destinos distintos).
 *
 * Orden (el mismo del layout):
 *   1. is_disabled            → fuera de la app (superadmin nunca).
 *   2. ventana del piloto     → SOLO estudiantes.
 *   3. must_change_password   → manda a /cambiar-clave; los participantes de
 *                               piloto y el superadmin están exentos.
 */

export type PilotWindow = {
  name: string | null;
  status: string | null;
  scheduled_at: string | null;
  ended_at: string | null;
};

export type AccessBlock =
  | { kind: "none" }
  | { kind: "disabled" }
  | { kind: "pilot"; reason: "cancelado" | "not_yet" | "ended"; pilotName: string; date: string | null }
  | { kind: "temp_password" };

/**
 * ¿Este piloto bloquea hoy a sus estudiantes? Devuelve el motivo y la fecha
 * relevante, o null si la ventana está abierta.
 */
export function pilotWindowBlock(
  pilot: PilotWindow,
  now: number,
): { reason: "cancelado" | "not_yet" | "ended"; date: string | null } | null {
  const startsAt = pilot.scheduled_at ? new Date(pilot.scheduled_at).getTime() : null;
  const endsAt = pilot.ended_at ? new Date(pilot.ended_at).getTime() : null;

  if (pilot.status === "cancelado") return { reason: "cancelado", date: null };
  if (startsAt && now < startsAt) return { reason: "not_yet", date: pilot.scheduled_at };
  if ((endsAt && now > endsAt) || pilot.status === "finalizado") {
    return { reason: "ended", date: pilot.ended_at };
  }
  return null;
}

export function accessBlock(
  user: { role: string; is_disabled?: boolean | null; must_change_password?: boolean | null },
  /** Piloto en el que participa, si participa en alguno (la ventana puede estar abierta). */
  pilot: PilotWindow | null,
  now: number,
): AccessBlock {
  if (user.role === "superadmin") return { kind: "none" };
  if (user.is_disabled) return { kind: "disabled" };

  if (pilot && user.role === "student") {
    const blocked = pilotWindowBlock(pilot, now);
    if (blocked) {
      return { kind: "pilot", reason: blocked.reason, pilotName: pilot.name || "sin nombre", date: blocked.date };
    }
  }

  // Participar en un piloto exime del cambio de clave (usan clave de un solo uso).
  if (user.must_change_password && !pilot) return { kind: "temp_password" };

  return { kind: "none" };
}

/** Etiqueta corta para la insignia de la lista. */
export function accessBlockLabel(block: AccessBlock): string {
  switch (block.kind) {
    case "disabled":
      return "Desactivado";
    case "pilot":
      return block.reason === "cancelado"
        ? "Piloto cancelado"
        : block.reason === "not_yet"
          ? "Piloto no ha comenzado"
          : "Piloto cerrado";
    case "temp_password":
      return "Clave temporal pendiente";
    default:
      return "";
  }
}

/** Texto explicativo (tooltip): qué hacer para desbloquear. */
export function accessBlockDetail(block: AccessBlock): string {
  const fecha = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "");
  switch (block.kind) {
    case "disabled":
      return "La cuenta está desactivada: no puede iniciar sesión. Reactívela con el interruptor de esta fila.";
    case "pilot":
      if (block.reason === "cancelado") {
        return `El piloto «${block.pilotName}» está cancelado. Cambie su estado en Pilotos para devolver el acceso.`;
      }
      if (block.reason === "not_yet") {
        return `El piloto «${block.pilotName}» comienza el ${fecha(block.date)}. Hasta entonces no puede entrar.`;
      }
      return `El piloto «${block.pilotName}» cerró${block.date ? " el " + fecha(block.date) : ""}. Ajuste "Fin de acceso" en Pilotos para devolver el acceso.`;
    case "temp_password":
      return "Tiene una clave temporal sin cambiar: al entrar se le pedirá definir una propia.";
    default:
      return "";
  }
}

/** Valores admitidos por el filtro "estado de acceso" de /admin/usuarios. */
export const ACCESS_FILTERS = ["bloqueado", "desactivado", "piloto", "clave"] as const;
export type AccessFilter = (typeof ACCESS_FILTERS)[number];
