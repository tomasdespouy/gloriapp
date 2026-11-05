// Limpia del texto del paciente lo que nunca debe llegar al estudiante: el
// razonamiento interno del modelo y el andamiaje del prompt.
//
// Módulo puro, sin dependencias, para poder probarlo contra respuestas reales.
//
// Dos niveles, según la certeza de poder separar la fuga de la respuesta:
//   1. Se puede recortar: bloques con etiqueta de cierre o seguidos de línea en
//      blanco. Queda la respuesta del paciente.
//   2. No se puede recortar: lo que sobrevive sigue pareciendo razonamiento. Se
//      descarta todo (cleaned = "") y el flujo del chat regenera en el otro
//      proveedor. Una respuesta perdida se recupera; un secreto clínico mostrado
//      al estudiante, no.

// "[THOUGHT] ... [/THOUGHT]", con cualquier nombre: una acotación real del
// paciente ("[suspira]") nunca trae etiqueta de cierre.
const PAIRED_BRACKET_BLOCK = /\[\s*([^\]\n/]{2,40}?)\s*\][\s\S]*?\[\/\s*\1\s*\]\s*/gi;
const PAIRED_XML_BLOCK = /<(thought|thoughts|think|thinking|reasoning|aside)>[\s\S]*?<\/\1>\s*/gi;

// "SILENT THOUGHT: ...", "[THOUGHT] ..." sin cierre, hasta la siguiente línea en blanco.
const REASONING_LABEL =
  "SILENCIO\\s+INTERNO|SILENT\\s+THOUGHTS?|INNER\\s+THOUGHTS?|INTERNAL\\s+(?:THOUGHTS?|MONOLOGUE)|THOUGHTS?|THINKING|REASONING|ASIDE|PENSAMIENTOS?\\s+INTERNOS?|RAZONAMIENTO";
const LABELED_BLOCK = new RegExp(
  `^[ \\t]*(?:\\[\\s*(?:${REASONING_LABEL})\\s*\\]\\s*:?|(?:${REASONING_LABEL})\\s*:)[^\\n]*(?:\\n(?!\\s*\\n)[^\\n]*)*(?:\\n\\s*\\n)?`,
  "gim",
);

const SCAFFOLD_LINE =
  /^[ \t]*\[(?:CONTEXTO\s+TEMPORAL|REGLA\s+CR[IÍ]TICA|MEMORIA\s+A\s+LARGO\s+PLAZO|FIN\s+MEMORIA|INSTRUCCI[OÓ]N(?:ES)?|SYSTEM\s*PROMPT|PROMPT\s*[:\]]|INICIO\s+DE\s+SESI[OÓ]N\s*—|REGLA\s+ANTI-REPETICI[OÓ]N|REGLA\s+DE\s+CONFIDENCIALIDAD)[^\]\n]*\][^\n]*$/gim;
const SYSTEM_LINE = /^[ \t]*SYSTEM\s*:[^\n]*$/gim;

// Señales de razonamiento que sobrevivió al recorte.
const RESIDUAL_PATTERNS: RegExp[] = [
  /\[\/?\s*(?:THOUGHTS?|THINKING|REASONING|ASIDE)\s*\]/i,
  /(?:^|\n)\s*\*{1,2}\s*Plan\s*:?\s*\*{1,2}/i,
  /\[\s*Piensa\s+para\s+s[ií]/i,
  /(?:^|\n)\s*Reglas\s*:\s*\n\s*1\./i,
];

// Razonamiento en inglés sin etiqueta. Se exigen dos señales distintas: una sola
// puede ser una palabra suelta en una respuesta legítima.
const ENGLISH_REASONING_MARKERS: RegExp[] = [
  /\bthe user\b/i,
  /\bthe therapist\b/i,
  /\bthe student\b/i,
  /\bI should\b/i,
  /\bI need to\b/i,
  /\bI will\b/i,
  /\bin character\b/i,
  /\backnowledge\b/i,
];

function hasResidualReasoning(text: string): boolean {
  if (RESIDUAL_PATTERNS.some((re) => re.test(text))) return true;
  return ENGLISH_REASONING_MARKERS.filter((re) => re.test(text)).length >= 2;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Devuelve el texto que puede ver el estudiante.
 * cleaned === "" con changed === true: había fuga y no se pudo separar; hay que regenerar.
 */
export function stripPromptLeaks(text: string): { cleaned: string; changed: boolean } {
  if (!text) return { cleaned: text, changed: false };

  const cleaned = normalizeWhitespace(
    text
      .replace(PAIRED_BRACKET_BLOCK, "")
      .replace(PAIRED_XML_BLOCK, "")
      .replace(LABELED_BLOCK, "")
      .replace(SCAFFOLD_LINE, "")
      .replace(SYSTEM_LINE, ""),
  );

  if (hasResidualReasoning(cleaned)) return { cleaned: "", changed: true };

  // Se compara contra el original normalizado: un espacio al final no es una fuga.
  return { cleaned, changed: cleaned !== normalizeWhitespace(text) };
}

/**
 * Quita las fugas del historial que se envía al modelo. Si un mensaje fugado
 * vuelve como contexto, el modelo lo imita en los turnos siguientes.
 */
export function stripLeaksFromHistory<T extends { role: string; content: string }>(history: T[]): T[] {
  return history.flatMap((m) => {
    if (m.role !== "assistant") return [m];
    const { cleaned, changed } = stripPromptLeaks(m.content);
    if (!changed) return [m];
    return cleaned ? [{ ...m, content: cleaned }] : [];
  });
}
