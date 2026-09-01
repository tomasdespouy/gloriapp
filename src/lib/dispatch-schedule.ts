/**
 * Reparto temporal de un envío programado de credenciales.
 *
 * Funciones puras, sin base de datos: las usan tanto la ruta que agenda (para
 * calcular el send_after de cada fila) como la UI (para prometer una ventana
 * honesta antes de que el admin confirme). Que sean la MISMA función es lo que
 * impide que la pantalla diga "sale a las 09:00" y el worker haga otra cosa.
 */

/** Ritmo de un lote. perBatch=0 y everyMinutes=0 significa "todo de una vez". */
export interface Pace {
  perBatch: number;
  everyMinutes: number;
}

export interface Slot {
  batchIndex: number;
  sendAfter: string;
}

/**
 * Instante en que le toca a la fila `i` (0-based) dentro del lote.
 *
 * Con perBatch=50 y everyMinutes=60: las primeras 50 salen a startsAt, las
 * siguientes 50 una hora después, y así. El índice de tanda se persiste en la
 * fila para que reprogramar mueva el bloque completo sin aplanar el escalonado.
 */
export function slotFor(startsAtIso: string, i: number, pace: Pace): Slot {
  const base = new Date(startsAtIso).getTime();
  const batchIndex = pace.perBatch > 0 ? Math.floor(i / pace.perBatch) : 0;
  const offsetMs = batchIndex * pace.everyMinutes * 60_000;
  return { batchIndex, sendAfter: new Date(base + offsetMs).toISOString() };
}

/** Recalcula el instante de una fila ya creada, preservando su tanda. */
export function slotForBatchIndex(startsAtIso: string, batchIndex: number, pace: Pace): string {
  const base = new Date(startsAtIso).getTime();
  return new Date(base + batchIndex * pace.everyMinutes * 60_000).toISOString();
}

export interface ScheduleRange {
  firstIso: string;
  lastIso: string;
  tandas: number;
}

/**
 * Ventana que la interfaz promete: desde cuándo hasta cuándo saldrán los
 * correos. Nunca se muestra un instante único para un lote escalonado — con
 * 124 personas a ~1,6 s cada una, "sale a las 09:00" sería mentira aunque no
 * hubiera tandas.
 */
export function scheduleRange(count: number, startsAtIso: string, pace: Pace): ScheduleRange {
  if (count <= 0) {
    return { firstIso: startsAtIso, lastIso: startsAtIso, tandas: 0 };
  }
  const tandas = pace.perBatch > 0 ? Math.ceil(count / pace.perBatch) : 1;
  const last = slotFor(startsAtIso, count - 1, pace);
  return { firstIso: startsAtIso, lastIso: last.sendAfter, tandas };
}

/**
 * Costo real medido por correo: rotar la contraseña vía la Admin API, llamar a
 * Resend y escribir dos veces la fila ≈ 0,9 s, más 0,7 s de espaciado para no
 * pasar el límite del proveedor.
 */
export const SECONDS_PER_EMAIL = 1.6;

/**
 * Estos dos DEBEN coincidir con las constantes del worker
 * (src/app/api/cron/dispatch-credentials/route.ts) y con el schedule del cron
 * en vercel.json. Si allá cambian y acá no, la interfaz promete un tiempo que
 * el despachador no puede cumplir.
 */
export const MAX_POR_CORRIDA = 50;
export const MINUTOS_ENTRE_CORRIDAS = 5;

/**
 * Minutos que tarda en vaciarse una tanda, contando el techo del despachador.
 *
 * No basta con multiplicar por el costo de cada correo: el worker manda como
 * máximo 50 por corrida y las corridas van cada 5 minutos, así que una tanda de
 * 200 no tarda 5 minutos sino cerca de 20, repartidos en cuatro corridas. Antes
 * la pantalla decía lo primero y era mentira.
 */
export function estimatedMinutesPerTanda(count: number, pace: Pace): number {
  const enTanda = pace.perBatch > 0 ? Math.min(pace.perBatch, count) : count;
  if (enTanda <= 0) return 0;

  const corridas = Math.ceil(enTanda / MAX_POR_CORRIDA);
  // Las corridas completas esperan el intervalo del cron; la última solo tarda
  // lo que le toma despachar sus propios correos.
  const enLaUltima = enTanda - (corridas - 1) * MAX_POR_CORRIDA;
  const minutosUltima = (enLaUltima * SECONDS_PER_EMAIL) / 60;

  return Math.max(1, Math.ceil((corridas - 1) * MINUTOS_ENTRE_CORRIDAS + minutosUltima));
}

/**
 * Valida un ritmo antes de guardarlo. Devuelve null si está bien, o el motivo
 * en español si no. El CHECK de la tabla cubre lo mismo, pero acá el mensaje
 * se puede mostrar en pantalla.
 */
export function validatePace(pace: Pace): string | null {
  const { perBatch, everyMinutes } = pace;
  if (perBatch === 0 && everyMinutes === 0) return null;
  if (perBatch <= 0 || everyMinutes <= 0) {
    return "Para escalonar hay que indicar cuántos correos por tanda y cada cuántos minutos.";
  }
  if (perBatch > 500) return "El máximo por tanda es 500.";
  if (everyMinutes > 10080) return "El intervalo máximo entre tandas es una semana.";
  return null;
}
