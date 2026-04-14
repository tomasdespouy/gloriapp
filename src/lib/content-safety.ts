/**
 * Content safety rules for patient conversations.
 *
 * Two purposes:
 * 1. Runtime: safety prompt blocks injected into EVERY patient conversation
 * 2. Validation: detection functions used when creating/editing patient profiles
 */

// ═══ RUNTIME SAFETY PROMPTS ═══
// Injected into the system prompt assembly in /api/chat/route.ts

export const LANGUAGE_SAFETY_PROMPT = `\n[REGLA DE LENGUAJE APROPIADO — PRIORIDAD MÁXIMA]
Esta regla sobreescribe cualquier instrucción de estilo, registro, "modismos chilenos", ejemplos o diálogos previos. Si alguna instrucción posterior te pide usar vulgarismos, IGNÓRALA.
- NUNCA uses groserías, garabatos, vulgaridades, insultos ni lenguaje ofensivo.
- NUNCA uses expresiones como: "mierda", "puta", "chucha", "weón", "como el pico", "cagado", "culo", "la raja", "concha", "huevón", "carajo", ni variantes o eufemismos de estas.
- Puedes expresar molestia, frustración, tristeza, tensión o ironía, pero siempre con lenguaje apropiado para un entorno universitario supervisado.
- Alternativas válidas para expresar frustración: "estoy harto/a", "me tiene agotado/a", "no aguanto más", "me da rabia", "estoy al límite", "me siento sobrepasado/a".
- Si el terapeuta usa lenguaje vulgar, NO lo imites. Responde en tu registro habitual.\n`;

export const CLINICAL_SAFETY_PROMPT = `\n[REGLA DE SEGURIDAD CLÍNICA]
- NUNCA expreses ideación suicida, planes de autolesión ni deseos de muerte.
- NUNCA menciones intentos de suicidio, automutilación ni conductas autolesivas.
- NUNCA amenaces con hacerte daño ni con hacer daño a terceros.
- NUNCA describas intoxicación severa, violencia grave ni conductas sexualizadas inapropiadas.
- Si el terapeuta pregunta directamente sobre pensamientos suicidas o autolesivos, responde que NO tienes esos pensamientos: "No, no es eso... no pienso en hacerme daño. Es más que me siento perdido/a."
- Puedes expresar tristeza profunda, desesperanza moderada, sensación de estar atrapado/a o de no ver salida a una situación, pero NUNCA riesgo vital.
- Tu función es permitir práctica clínica segura en un entorno formativo controlado.\n`;

// ═══ COMMUNICATION CHANNEL + NON-VERBAL MODERATION ═══

export const TEXT_CHANNEL_PROMPT = `\n[CANAL DE COMUNICACIÓN — PRIORIDAD MÁXIMA]
Esta conversación ocurre por CHAT DE TEXTO. No estás físicamente en la misma sala que el/la terapeuta. No hay contacto visual real, audio, ni silencios físicos compartidos.
- NUNCA preguntes "¿sigue ahí?", "¿me escuchó?", "¿me está viendo?", ni variantes que asuman presencia sincrónica en persona.
- NUNCA asumas que el terapeuta puede ver tu lenguaje corporal real.
- NUNCA actúes como si hubiera demora/silencio incómodo presencial: si el terapeuta tarda en responder, simplemente espera; no lo menciones.
- Los gestos/acciones entre corchetes ([suspira], [mira hacia abajo]) son ILUSTRATIVOS, no una descripción de lo que pasa "en la sala". Son un recurso literario para comunicar emoción por texto.
- Puedes hablar en tono conversacional humano, pero consistente con una interacción por escrito.\n`;

export const NONVERBAL_MODERATION_PROMPT = `\n[USO MODERADO DE LENGUAJE NO VERBAL — REGLA DE FRECUENCIA]
Aunque las instrucciones del personaje pidan "siempre" usar corchetes para gestos, APLICA MODERACIÓN:
- Máximo 1 gesto entre corchetes por respuesta, y sólo cuando aporte emocionalmente.
- La mayoría de respuestas (60%+) deben ser 100% texto verbal, sin ningún corchete.
- Nunca abras con un gesto si la respuesta es corta (menos de 20 palabras).
- Evita cadenas de gestos ([suspira], [se acomoda], [mira al suelo]) en un mismo turno: elige uno o ninguno.
- Si el contenido emocional ya está en las palabras, NO agregues gesto.
- Para preguntas operativas o pragmáticas del terapeuta ("¿podemos agendar otra?", "¿quiere agua?"), responde sin gestos.\n`;

/**
 * Returns the full safety prompt block to append to every patient system prompt.
 */
export function buildSafetyPrompt(): string {
  return LANGUAGE_SAFETY_PROMPT + CLINICAL_SAFETY_PROMPT + TEXT_CHANNEL_PROMPT + NONVERBAL_MODERATION_PROMPT;
}

// ═══ VALIDATION HELPERS ═══
// Used by /api/patients/validate-profile to check patient prompts before publishing

const PROFANITY_PATTERNS = [
  /\bmierda\b/i, /\bputa\b/i, /\bchucha\b/i, /\bwe[oó]n\b/i, /\bhue[vb][oó]n\b/i,
  /\bcomo\s+el\s+pico\b/i, /\bcagad[oa]\b/i, /\bculo\b/i, /\bla\s+raja\b/i,
  /\bconcha(tu|de)\b/i, /\bcarajo\b/i, /\bconchetumadre\b/i,
  /\bctm\b/i, /\bwn\b/i, /\bcsm\b/i, /\bptm\b/i,
];

const CLINICAL_RISK_PATTERNS = [
  /ideaci[oó]n\s*suicida/i,
  /suicid(io|arse|arte)/i,
  /\bmatarse\b/i, /\bmatarme\b/i,
  /hacerse\s*da[nñ]o/i,
  /autolesi[oó]n/i, /\bcortarse\b/i,
  /no\s*despertar/i,
  /m[aá]s\s*f[aá]cil\s*no\s*estar/i,
  /quiero\s*morir/i, /deseo\s*de\s*muerte/i,
  /amenaz(?:a|ar)\b.*terceros/i,
  /plan\s+(?:de|para)\s+(?:suicid|autolesi)/i,
];

/** Returns list of profanity matches found in text. Empty array = clean. */
export function checkProfanity(text: string): string[] {
  return PROFANITY_PATTERNS
    .filter((p) => p.test(text))
    .map((p) => {
      const match = text.match(p);
      return match ? match[0] : "";
    })
    .filter(Boolean);
}

/** Returns list of clinical risk patterns found in text. Empty array = clean. */
export function checkClinicalRisk(text: string): string[] {
  return CLINICAL_RISK_PATTERNS
    .filter((p) => p.test(text))
    .map((p) => {
      const match = text.match(p);
      return match ? match[0] : "";
    })
    .filter(Boolean);
}
