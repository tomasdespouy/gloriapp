/**
 * Per-patient conversational pacing profiles.
 *
 * Controls three things that make a patient feel more or less human:
 *   1. How fast the typewriter effect runs (charDelayMs)
 *   2. How long the "thinking…" phase lasts before the first token
 *   3. How the silence-nudge system paces and when it disconnects
 *
 * A patient's profile comes from `ai_patients.pacing_profile`. If that
 * value is null (legacy rows pre-migration) we fall back to
 * "conversational_medium" which is the safest middle ground.
 */

export type PacingProfileKey =
  | "anxious_fast"
  | "conversational_medium"
  | "reflective_paused"
  | "depressive_slow"
  | "inhibited_timid";

export type PacingProfile = {
  /** ms per character emitted by the client-side typewriter */
  charDelayMs: number;
  /** micro-pause after ". ! ?" to feel like a breath */
  sentenceGapMinMs: number;
  sentenceGapMaxMs: number;
  /** extra thinking delay added server-side before the LLM stream
      starts, on top of whatever latency the model already has */
  thinkingMinMs: number;
  thinkingMaxMs: number;
  /** if the real LLM already took longer than this, skip the
      artificial thinking delay entirely so we don't pile up waits */
  thinkingCeilingMs: number;
  /** silence nudge thresholds in ms; length defines maxStages */
  silenceThresholdsMs: number[];
  /** En la primera sesion el paciente debe preguntar el nombre del
      terapeuta si este no se ha presentado. Cada arquetipo lo hace en
      un turno distinto y con un estilo distinto. La inyeccion se hace
      server-side desde /api/chat/route.ts, una sola vez en el turno
      indicado. */
  introductionProtocol?: {
    /** turno del paciente (= turn_number en clinical_state_log)
        donde se inyecta la instruccion */
    askNameAtTurn: number;
    /** etiqueta de estilo que se inserta literal en el prompt — el
        LLM la usa como guia del tono */
    askNameStyle: string;
    /** 3 variantes de frase para inspirar al LLM (no se copian
        literal, se adaptan a la personalidad del paciente) */
    askNameVariants: string[];
  };
};

// Typing speed reference:
//   The client drains 2 chars per tick, so effective char-rate is
//   (2 / charDelayMs) chars per second.
//   e.g. charDelayMs=75 → ~27 chars/s → ~5.4 words/s.
//
// Previous calibration (Apr 14) had everyone between 44-111 chars/s,
// which feels instantaneous to the human eye. These values deliberately
// slow the typing to the 15-40 chars/s range so the student actually
// *sees* the patient thinking-as-they-write. Thinking delay (pre-stream
// pause) is UNTOUCHED — that's a separate axis.
export const PACING_PROFILES: Record<PacingProfileKey, PacingProfile> = {
  anxious_fast: {
    charDelayMs: 50, // ~40 cps / ~8 wps
    sentenceGapMinMs: 120,
    sentenceGapMaxMs: 260,
    thinkingMinMs: 500,
    thinkingMaxMs: 1500,
    thinkingCeilingMs: 800,
    silenceThresholdsMs: [45_000, 90_000, 150_000, 300_000],
    introductionProtocol: {
      askNameAtTurn: 2,
      askNameStyle: "demandante e impaciente",
      askNameVariants: [
        "Perdón, ¿cómo me dijo que se llamaba? No le entendí bien.",
        "A todo esto, ¿cómo le digo a usted? No me dijo su nombre.",
        "Disculpe que le interrumpa, pero no sé ni cómo se llama, ¿me lo repite?",
      ],
    },
  },
  conversational_medium: {
    charDelayMs: 75, // ~27 cps / ~5.3 wps
    sentenceGapMinMs: 220,
    sentenceGapMaxMs: 420,
    thinkingMinMs: 900,
    thinkingMaxMs: 2500,
    thinkingCeilingMs: 800,
    silenceThresholdsMs: [60_000, 120_000, 210_000, 300_000],
    introductionProtocol: {
      askNameAtTurn: 3,
      askNameStyle: "natural y cálido",
      askNameVariants: [
        "Disculpe, creo que no le entendí bien su nombre. ¿Me lo podría repetir?",
        "A todo esto, ¿cómo le digo a usted? Quiero asegurarme de tratarle bien.",
        "Perdón si es muy básica la pregunta… ¿cómo es su nombre?",
      ],
    },
  },
  reflective_paused: {
    charDelayMs: 110, // ~18 cps / ~3.6 wps
    sentenceGapMinMs: 400,
    sentenceGapMaxMs: 800,
    thinkingMinMs: 2000,
    thinkingMaxMs: 4500,
    thinkingCeilingMs: 1200,
    silenceThresholdsMs: [75_000, 150_000, 240_000, 300_000],
    introductionProtocol: {
      askNameAtTurn: 4,
      askNameStyle: "introspectivo y curioso, observando la situación",
      askNameVariants: [
        "Pensaba en algo mientras le escuchaba… qué raro estar contándole esto y no saber ni su nombre.",
        "Es curioso… llevamos un rato y todavía no sé cómo llamarle. ¿Cuál es su nombre?",
        "Mientras le escuchaba me di cuenta de que no sé ni cómo se llama. Disculpe la pregunta.",
      ],
    },
  },
  depressive_slow: {
    charDelayMs: 140, // ~14 cps / ~2.9 wps
    sentenceGapMinMs: 500,
    sentenceGapMaxMs: 1000,
    thinkingMinMs: 1500,
    thinkingMaxMs: 4000,
    thinkingCeilingMs: 1000,
    silenceThresholdsMs: [90_000, 180_000, 300_000],
    introductionProtocol: {
      askNameAtTurn: 5,
      askNameStyle: "suave y autodesvalorizante, casi disculpándose por preguntar",
      askNameVariants: [
        "Perdone… esto va a sonar tonto, pero… no sé cómo se llama usted.",
        "Disculpe… me da pena preguntar tan tarde, pero no me quedó claro su nombre.",
        "Igual capaz no importa, pero… ¿cómo dijo que se llamaba?",
      ],
    },
  },
  inhibited_timid: {
    charDelayMs: 95, // ~21 cps / ~4.2 wps
    sentenceGapMinMs: 300,
    sentenceGapMaxMs: 650,
    thinkingMinMs: 1200,
    thinkingMaxMs: 3000,
    thinkingCeilingMs: 1000,
    silenceThresholdsMs: [90_000, 180_000, 300_000],
    introductionProtocol: {
      askNameAtTurn: 6,
      askNameStyle: "muy tímido e indirecto, frase entrecortada",
      askNameVariants: [
        "Eh… qué vergüenza… creo que no le pregunté su nombre.",
        "Discúlpeme… no sé bien cómo decirle… ¿usted es…?",
        "Mmm… perdón… ¿le puedo preguntar su nombre? Me dio pena antes.",
      ],
    },
  },
};

export const DEFAULT_PACING_KEY: PacingProfileKey = "conversational_medium";

/** Human-friendly name shown to the admin when editing a patient */
export const PACING_LABELS: Record<PacingProfileKey, string> = {
  anxious_fast: "Ansioso / rápido",
  conversational_medium: "Conversacional / medio",
  reflective_paused: "Reflexivo / pausado",
  depressive_slow: "Depresivo / lento",
  inhibited_timid: "Tímido / inhibido",
};

/** Resolves a (possibly null) DB value to a concrete profile. */
export function getPacingProfile(key: string | null | undefined): PacingProfile {
  if (key && key in PACING_PROFILES) {
    return PACING_PROFILES[key as PacingProfileKey];
  }
  return PACING_PROFILES[DEFAULT_PACING_KEY];
}

/** Returns a random integer in [min, max] */
export function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Resolves how long we should artificially wait before streaming.
    Returns 0 if the real LLM has already blown past the ceiling. */
export function thinkingDelayFor(profile: PacingProfile, realElapsedMs: number): number {
  if (realElapsedMs >= profile.thinkingCeilingMs) return 0;
  return randomBetween(profile.thinkingMinMs, profile.thinkingMaxMs);
}

/**
 * Detecta si el estudiante se presento por su nombre en cualquiera de
 * los mensajes que envio. Usada por el protocolo de identificacion del
 * paciente IA — si devuelve true, el paciente NO insistira en preguntar.
 *
 * Patrones aceptados (case-insensitive salvo el ultimo):
 *   - "me llamo X"
 *   - "mi nombre es X"
 *   - "aqui (le) habla X"
 *   - "Soy X" donde X arranca con mayuscula (case-sensitive a proposito
 *     para evitar falsos positivos como "soy chilena", "soy estudiante",
 *     "soy de Argentina"). Permite prefijos como "Soy el doctor X",
 *     "Soy la psicologa X", "Soy terapeuta X".
 *
 * Returns true si CUALQUIER mensaje del estudiante matchea.
 */
export function hasStudentIntroducedName(messages: string[]): boolean {
  for (const msg of messages) {
    if (/\bme\s+llamo\s+\S/i.test(msg)) return true;
    if (/\bmi\s+nombre\s+es\s+\S/i.test(msg)) return true;
    if (/\baqu[ií]\s+(?:le\s+)?habla\s+\S/i.test(msg)) return true;
    // "soy X" / "Soy X" — el verbo es case-insensitive pero el nombre
    // DEBE arrancar con mayuscula (capitalizado). Asi diferenciamos
    // "soy Tomas" (nombre propio) de "soy chilena", "soy estudiante",
    // "soy de Argentina", "soy una persona" (todos lowercase tras "soy").
    if (/\b[Ss]oy\s+(?:el\s+|la\s+)?(?:doctor[ae]?\s+|psic[oó]log[ao]\s+|terapeuta\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(msg)) return true;
  }
  return false;
}

/**
 * Construye el bloque [PROTOCOLO DE IDENTIFICACION] que se inyecta en
 * el system prompt del paciente justo antes del turno indicado por el
 * arquetipo. Devuelve string vacio si el protocolo no aplica (no hay
 * config, no es el turno, o el estudiante ya se presento).
 *
 * Reglas:
 *   - Solo en primera sesion (sessionNumber === 1; null/undefined se
 *     trata como "es primera" para no romper sesiones legacy).
 *   - Solo en el turno EXACTO definido por el arquetipo. No reintenta.
 *   - Solo si el estudiante no se ha presentado.
 */
export function buildIntroductionRule(
  profile: PacingProfile,
  turnNumber: number,
  sessionNumber: number | null | undefined,
  studentMessages: string[],
): string {
  const intro = profile.introductionProtocol;
  if (!intro) return "";
  if (turnNumber !== intro.askNameAtTurn) return "";
  if (sessionNumber != null && sessionNumber !== 1) return "";
  if (hasStudentIntroducedName(studentMessages)) return "";

  const variants = intro.askNameVariants
    .map((v, i) => `  ${i + 1}. "${v}"`)
    .join("\n");

  return `\n\n[PROTOCOLO DE IDENTIFICACION]
Aun no sabes el nombre del terapeuta porque no se presento. En ESTA respuesta, integra de forma natural una pregunta por su nombre, en estilo: ${intro.askNameStyle}.

Variantes de inspiracion (NO las copies textuales — adapta a tu personalidad y al hilo del momento):
${variants}

Reglas:
- Pregunta solo UNA vez. Si la respuesta natural seria muy corta, esta pregunta puede ser tu mensaje completo.
- No insistas en turnos siguientes — esta es tu unica oportunidad de preguntar el nombre con esta intencionalidad.
- Manten tu personalidad al pie: si eres timido(a), preguntalo con vacilacion; si eres ansioso(a), con urgencia.
- Si el terapeuta ya dijo su nombre y no lo notaste, mejor di "perdon, no le entendi bien" en vez de inventar uno.\n`;
}
