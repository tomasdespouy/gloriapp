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
  /** Umbrales de nudge de silencio en ms; el largo define maxStages.
   *  El servidor los ESCALA para que el último = presupuesto de paciencia
   *  del difficulty_level (ver scaleSilenceThresholds). Las curvas están
   *  *back-loaded* a propósito: el 1er umbral es ~45-60% del techo, para que
   *  el primer "¿sigue ahí?" NO salga antes de ~2-3 min y no interrumpa
   *  intervenciones clínicas largas/reflexivas. (Antes eran front-loaded al
   *  15-30% → 1er aviso a ~50-80s, que los docentes reportaron como intrusivo.) */
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
    silenceThresholdsMs: [130_000, 190_000, 245_000, 300_000],
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
    silenceThresholdsMs: [150_000, 210_000, 255_000, 300_000],
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
    silenceThresholdsMs: [165_000, 220_000, 260_000, 300_000],
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
    silenceThresholdsMs: [180_000, 230_000, 265_000, 300_000],
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
    silenceThresholdsMs: [180_000, 230_000, 265_000, 300_000],
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
/**
 * Formas en que un terapeuta entrega su nombre. La version original solo
 * cubria "me llamo / mi nombre es / aqui le habla / Soy X" con el nombre
 * OBLIGATORIAMENTE capitalizado, y dejaba fuera lo que la gente escribe de
 * verdad: "puedes decirme Sofia", "llamame X", "te saluda X", "soy sofia"
 * en minuscula. Una alumna respondio "Puedes decirme Sofia o Sofi" cuando la
 * paciente le pregunto el nombre y el sistema la siguio contando como "nunca
 * se presento": tres turnos despues le cerro la sesion (caso practica CAP UGM,
 * 6-ago-2026).
 *
 * El error es ASIMETRICO: un falso positivo solo hace que la paciente no
 * pregunte el nombre; un falso negativo TERMINA la sesion de un alumno que si
 * se presento. Por eso ahora se peca de permisivo.
 *
 * `studentFullName` (del perfil) es la red de seguridad definitiva: si el
 * alumno escribio su propio nombre de pila en cualquier forma que no
 * anticipamos, se considera presentado.
 */
export function hasStudentIntroducedName(messages: string[], studentFullName?: string | null): boolean {
  const firstName = firstNameOf(studentFullName);
  if (firstName) {
    const re = new RegExp(`(^|[^a-z])${escapeRegex(firstName)}([^a-z]|$)`, "i");
    if (messages.some((m) => re.test(stripAccents(m)))) return true;
  }
  for (const msg of messages) {
    if (/\bme\s+llamo\s+\S/i.test(msg)) return true;
    if (/\bmi\s+nombre\s+(?:es\s+)?\S/i.test(msg)) return true;
    if (/\baqu[ií]\s+(?:le\s+)?habla\s+\S/i.test(msg)) return true;
    if (/\b(?:te|le)\s+(?:saluda|habla)\s+\S/i.test(msg)) return true;
    // "puedes decirme X" / "llamame X" / "dime X" / "digame X"
    if (/\b(?:pued[eo]s?|pod[eé]s|puede)\s+(?:decirme|llamarme|tratarme\s+de)\s+\S/i.test(msg)) return true;
    if (/\b(?:ll[aá]m[ae]me|ll[aá]meme|d[ií]game|dime)\s+\S/i.test(msg)) return true;
    // "soy X" — ahora acepta minuscula (la gente no capitaliza al tipear) y se
    // apoya en NOT_A_NAME para descartar roles, nacionalidades y muletillas.
    const m = msg.match(/\b[Ss]oy\s+(?:el\s+|la\s+)?(?:doctor[ae]?\s+|psic[oó]log[ao]\s+|terapeuta\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/);
    if (m && !NOT_A_NAME.has(stripAccents(m[1]))) return true;
  }
  return false;
}

/** Primer nombre util (>=3 letras, sin tildes) o null. */
function firstNameOf(fullName?: string | null): string | null {
  if (!fullName) return null;
  const first = stripAccents(fullName.trim()).split(/\s+/)[0] || "";
  return first.length >= 3 ? first : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Palabras que NO son nombres aunque aparezcan capitalizadas tras "Soy"
// (nacionalidades, roles, estados). Se comparan sin tildes y en minuscula
// para no pinear "Soy Chilena" o "Soy Estudiante" como si fueran el nombre.
const NOT_A_NAME = new Set([
  "chileno", "chilena", "peruano", "peruana", "argentino", "argentina",
  "colombiano", "colombiana", "mexicano", "mexicana", "boliviano", "boliviana",
  "espanol", "espanola", "uruguayo", "uruguaya", "venezolano", "venezolana",
  "ecuatoriano", "ecuatoriana", "paraguayo", "paraguaya",
  "estudiante", "psicologo", "psicologa", "terapeuta", "doctor", "doctora",
  "alumno", "alumna", "practicante", "interno", "interna", "profesional",
  "supervisor", "supervisora", "nuevo", "nueva", "yo",
  // Palabras funcionales: necesarias ahora que "soy x" acepta minusculas
  // ("soy tu terapeuta", "soy quien te acompana", "soy la persona que...").
  "tu", "su", "mi", "el", "la", "un", "una", "quien", "alguien", "parte",
  "todo", "toda", "muy", "tan", "solo", "sola", "mas", "menos", "aqui",
  "consciente", "capaz", "responsable", "docente", "profesor", "profesora",
  "tuyo", "tuya", "suyo", "suya", "de", "del", "para", "por", "como",
]);

function stripAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function capitalizeName(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Extrae el nombre con el que el estudiante se presento, si lo hizo. Usa
 * los mismos patrones que hasStudentIntroducedName pero con grupo de
 * captura. Devuelve el primer nombre encontrado (capitalizado) o null.
 *
 * Conservador a proposito: para "Soy X" descarta nacionalidades/roles
 * (NOT_A_NAME) para no fijar un "nombre" equivocado. Los patrones "me
 * llamo X" / "mi nombre es X" son de alta confianza.
 */
export function extractStudentName(messages: string[]): string | null {
  // Case-insensitive: la gente tipea su nombre en minuscula. capitalizeName
  // se encarga de dejarlo presentable para que el paciente lo use.
  const NAME = "([A-Za-zÁÉÍÓÚÑáéíóúñ]+)";
  const HIGH_CONFIDENCE = [
    `\\bme\\s+llamo\\s+${NAME}`,
    `\\bmi\\s+nombre\\s+(?:es\\s+)?${NAME}`,
    `\\baqu[ií]\\s+(?:le\\s+)?habla\\s+${NAME}`,
    `\\b(?:te|le)\\s+(?:saluda|habla)\\s+${NAME}`,
    `\\b(?:pued[eo]s?|pod[eé]s|puede)\\s+(?:decirme|llamarme|tratarme\\s+de)\\s+${NAME}`,
    `\\b(?:ll[aá]m[ae]me|ll[aá]meme|d[ií]game|dime)\\s+${NAME}`,
    `\\b[Ss]oy\\s+(?:el\\s+|la\\s+)?(?:doctor[ae]?\\s+|psic[oó]log[ao]\\s+|terapeuta\\s+)?${NAME}`,
  ];
  for (const msg of messages) {
    for (const pattern of HIGH_CONFIDENCE) {
      const m = msg.match(new RegExp(pattern, "i"));
      // NOT_A_NAME evita fijar "chilena", "estudiante" o "tu" como nombre.
      if (m && !NOT_A_NAME.has(stripAccents(m[1]))) return capitalizeName(m[1]);
    }
  }
  return null;
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
  studentFullName?: string | null,
): string {
  const intro = profile.introductionProtocol;
  if (!intro) return "";
  if (turnNumber !== intro.askNameAtTurn) return "";
  if (sessionNumber != null && sessionNumber !== 1) return "";
  if (hasStudentIntroducedName(studentMessages, studentFullName)) return "";

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
- Aprovecha para ofrecer TAMBIEN tu propio nombre (el del paciente) en el mismo intercambio, de forma natural y breve (ej: "...y usted, ¿como se llama? Yo soy [tu nombre]."). Sobrio, acorde a tu reserva inicial.
- Si el terapeuta ya dijo su nombre y no lo notaste, mejor di "perdon, no le entendi bien" en vez de inventar uno.\n`;
}

/**
 * Caso A de reciprocidad de presentacion: si el terapeuta se presento por
 * su nombre al inicio, el paciente devuelve el gesto dando el suyo,
 * MODULADO por su personalidad. Conservador por defecto: sobrio o timido,
 * no efusivo. Solo en la primera sesion y en los primeros turnos.
 *
 * Es excluyente con buildIntroductionRule (ese solo dispara cuando el
 * terapeuta NO se presento).
 */
export function buildSelfIntroductionRule(
  turnNumber: number,
  sessionNumber: number | null | undefined,
  therapistIntroducedThisTurn: boolean,
): string {
  if (!therapistIntroducedThisTurn) return "";
  if (turnNumber > 2) return "";
  if (sessionNumber != null && sessionNumber !== 1) return "";

  return `\n\n[RECIPROCIDAD DE PRESENTACION]
El terapeuta se presento por su nombre. Es natural devolver el gesto: en esta respuesta, di TU nombre (el del paciente) de forma BREVE, junto a tu saludo.
- Hazlo en coherencia con tu reserva inicial: por defecto es un "...soy [tu nombre]" sobrio o timido, NO un saludo efusivo.
- Solo si tu personalidad es marcadamente calida o ansiosa por agradar, puedes sonar un poco mas amable.
- No te extiendas, no expliques por que viniste, no hagas preguntas. Solo tu nombre + un saludo breve.\n`;
}

const INSIST_GRACE = 2; // turnos de insistencia tras el ask antes del quiebre

/**
 * Escalada cuando el terapeuta NO entrega su nombre tras habérselo
 * preguntado: el paciente INSISTE (no acepta "usted"/"doctor"/evasiva), y
 * si sigue sin darlo, se produce un QUIEBRE de la relacion (cierra sesion).
 *
 * Devuelve { rule, rupture }. rupture=true => la ruta cierra la sesion.
 * Solo primera sesion y solo si el terapeuta nunca dio un nombre.
 */
export function buildNameEscalation(
  profile: PacingProfile,
  turnNumber: number,
  sessionNumber: number | null | undefined,
  studentMessages: string[],
  studentFullName?: string | null,
): { rule: string; rupture: boolean } {
  const intro = profile.introductionProtocol;
  if (!intro) return { rule: "", rupture: false };
  if (sessionNumber != null && sessionNumber !== 1) return { rule: "", rupture: false };
  if (hasStudentIntroducedName(studentMessages, studentFullName)) return { rule: "", rupture: false };

  const ask = intro.askNameAtTurn;
  if (turnNumber <= ask) return { rule: "", rupture: false }; // el ask inicial lo maneja buildIntroductionRule

  if (turnNumber <= ask + INSIST_GRACE) {
    return {
      rule: `\n\n[INSISTENCIA POR EL NOMBRE]
Ya preguntaste el nombre del terapeuta y aun no te lo da, o te respondio con evasivas / "usted" / "doctor" / "doctora". Te incomoda cada vez mas hablar de algo intimo sin saber con quien. En ESTA respuesta INSISTE, mas directo(a) pero en personaje: deja claro que necesitas saber su nombre para sentirte en confianza. NO aceptes "doctor", "doctora", "usted" ni una evasiva como respuesta valida.\n`,
      rupture: false,
    };
  }

  return {
    rule: `\n\n[QUIEBRE POR FALTA DE NOMBRE — PRIORIDAD MAXIMA]
Preguntaste varias veces el nombre del terapeuta y sigue sin dartelo o te evade. No te sientes capaz de seguir abriendote con alguien que ni siquiera te dice su nombre. CIERRA la conversacion en personaje: di, breve (1-2 frases) y sin insultar, que asi no te sientes en confianza y que prefieres dejarlo aca.\n`,
    rupture: true,
  };
}

// Intencion de cierre del terapeuta (despedida) y deteccion de fecha/dia.
const CLOSING_RE = /\b(nos vemos|hasta (la proxima|luego|pronto|el)|me despido|eso ser[ií]a (todo|por hoy)|terminemos|cerremos|seguimos (la proxima|el)|gracias por (hoy|la sesion|venir)|nos vemos la proxima|que (tenga|tengas) (buen|buena)|chao|cha[uo]|adi[oó]s|hasta el)\b/i;
// Solo fechas CONCRETAS (dia de semana, mañana, hora, fecha numerica).
// "la proxima (semana)" es vago a proposito → el paciente debe pedir el dia.
const DATE_RE = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|pasado ma[ñn]ana|\d{1,2}\s*(de|\/|-)\s*\w+|a las\s*\d|\d{1,2}\s*(am|pm|hrs|hr|h\b))\b/i;

/**
 * Si el terapeuta esta cerrando la sesion (se despide) pero NO menciona
 * cuando es la proxima cita, el paciente pregunta directamente por la
 * fecha/dia. Da realismo y deja registrada la proxima cita.
 */
export function buildClosingAppointmentRule(userMessages: string[]): string {
  const closing = userMessages.some((m) => CLOSING_RE.test(stripAccents(m)));
  if (!closing) return "";
  const hasDate = userMessages.some((m) => DATE_RE.test(stripAccents(m)));
  if (hasDate) return "";

  return `\n\n[CIERRE SIN FECHA — PREGUNTA POR LA PROXIMA CITA]
El terapeuta esta cerrando la sesion pero no dijo cuando es la proxima vez. ANTES de despedirte, preguntale de forma natural para cuando quedan, en tu estilo y breve: "¿Y para cuando quedamos?", "¿que dia nos vemos?", "¿la proxima semana a la misma hora?", "¿que dia me dijo?". No te despidas sin preguntarlo.\n`;
}
