/**
 * "Horario hábil" para el envío de correos automáticos (crons de
 * recordatorio/credenciales/aviso a docente). Ancla a hora Chile — misma
 * zona de referencia que ya usa datetime-cl.ts para los pilotos — porque
 * hoy todas las instituciones activas (Chile, Perú, Paraguay) operan en
 * husos cercanos y esto es sobre no despertar a nadie de madrugada, no
 * sobre precisión de zona horaria por país. Si algún día hace falta
 * horario hábil por institución, esto es el lugar para ampliarlo — no
 * antes, sin un caso real que lo pida.
 *
 * No confundir con la ventana de acceso del piloto de voz (starts_at/
 * ends_at en UTC): esto es sobre CUÁNDO MANDAR un correo, no sobre cuándo
 * algo está permitido dentro de la app.
 */

const TZ = "America/Santiago";
const START_HOUR = 8;
const END_HOUR = 20; // exclusivo: hasta las 19:59
const WEEKEND_DAYS = new Set(["Sat", "Sun"]);

export function isBusinessHours(at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  if (WEEKEND_DAYS.has(weekday)) return false;
  return hour >= START_HOUR && hour < END_HOUR;
}
