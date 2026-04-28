/**
 * Helpers para anclar el manejo de fechas a horario Chile (America/Santiago)
 * en la administración de pilotos. Los TIMESTAMPTZ en Supabase siguen
 * almacenándose en UTC; estas funciones traducen entre UTC y "lo que el
 * admin ve y escribe en pantalla", interpretado siempre como hora Chile,
 * incluso si su navegador está en otra zona.
 *
 * No usar en endpoints públicos: la lógica de "ventana de acceso" del piloto
 * compara new Date() vs ended_at en UTC, que es correcto y portable.
 */

const CHILE_TZ = "America/Santiago";

/**
 * ISO UTC → string "YYYY-MM-DDTHH:MM" para <input type="datetime-local">,
 * anclado a hora Chile.
 *   utcIsoToChileLocal('2026-05-30T19:51:00.000Z') → '2026-05-30T15:51'
 */
export function utcIsoToChileLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: CHILE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * String "YYYY-MM-DDTHH:MM" del input (interpretado como hora Chile) → ISO UTC.
 *   chileLocalToUtcIso('2026-05-30T15:51') → '2026-05-30T19:51:00.000Z'
 *
 * Maneja CLT (UTC-4) y CLST (UTC-3) automáticamente: el offset se calcula
 * en el instante destino vía Intl, no se asume fijo.
 */
export function chileLocalToUtcIso(chileLocal: string): string {
  // Tomamos el datetime-local como UTC tentativo (sufijo Z), medimos el
  // offset que tenía Chile en ese instante y restamos. El resultado es
  // el ISO UTC correcto.
  const tentativeUtc = new Date(`${chileLocal}:00Z`);
  const offsetMin = chileOffsetMinutes(tentativeUtc);
  return new Date(tentativeUtc.getTime() - offsetMin * 60 * 1000).toISOString();
}

/**
 * Offset en minutos de la hora Chile respecto a UTC en un instante dado.
 * Devuelve -240 (UTC-4 invierno) o -180 (UTC-3 verano).
 */
function chileOffsetMinutes(at: Date): number {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
  const get = (parts: Intl.DateTimeFormatPart[], t: string) =>
    parseInt(parts.find((p) => p.type === t)!.value, 10);
  // Convertimos cada lado a un timestamp UTC ad-hoc; la resta nos da los
  // minutos de diferencia sin ambigüedad de wrap entre días.
  const toMs = (parts: Intl.DateTimeFormatPart[]) =>
    Date.UTC(
      get(parts, "year"),
      get(parts, "month") - 1,
      get(parts, "day"),
      get(parts, "hour"),
      get(parts, "minute"),
    );
  return (toMs(fmt(CHILE_TZ)) - toMs(fmt("UTC"))) / 60000;
}

/**
 * ISO UTC → fecha legible para listas/cards de admin, en hora Chile y
 * locale es-CL. Ejemplo: '30 may 2026, 15:51'.
 */
export function formatChileDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * Igual que formatChileDateTime pero solo la parte de fecha.
 *   '30 may 2026'
 */
export function formatChileDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
