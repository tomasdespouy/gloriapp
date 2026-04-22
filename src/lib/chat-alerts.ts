// Observational detector for chat turns.
//
// Fires lightweight alerts WITHOUT ever blocking or rewriting a
// conversation. The output is persisted in the `chat_alerts` table and
// surfaced in the pilot dashboard so superadmins can audit edge cases
// after the fact.
//
// Detection is lexical + regex-based. This is intentional: the point
// is to surface suspicious patterns cheaply (zero extra LLM calls per
// turn, matters when thousands of messages happen per pilot), and let
// a human decide in the dashboard whether each alert is a real
// incident or normal therapeutic content.
//
// Spanish-aware (LatAm + peninsular) but not exhaustive — we prefer a
// narrow list of high-signal terms over a long list that would fire
// every other message. Word boundaries prevent common false positives
// ("vergüenza" vs "verga", "culturales" vs "culo").

export type AlertKind =
  | "short_response"
  | "profanity"
  | "violence"
  | "self_harm"
  | "disrespect"
  | "prompt_leak";

export type AlertSource = "user" | "assistant";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertSpec = {
  kind: AlertKind;
  severity: AlertSeverity;
  /** Terms that matched, comma-separated. Kept so the admin sees
      exactly why the alert fired without having to guess. */
  matchedTerms: string;
  /** Short snippet for quick scanning in the dashboard. */
  sample: string;
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Strip diacritics so matching works for "está" ~ "esta",
 *  "niño" ~ "nino", etc. Output stays lowercase. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Build a regex that matches any of the terms as whole words.
 *  Terms are matched after normalization, so pass them without
 *  diacritics (e.g. "imbecil", not "imbécil"). */
function buildTermRegex(terms: string[]): RegExp {
  // Escape regex special chars in case a term contains them.
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Word boundaries via explicit lookarounds that also treat punctuation
  // as a boundary (so "¡matar!", "matar.", "matar?" all match).
  return new RegExp(`(?:^|[\\s.,;:!?¡¿'"()\\[\\]-])(${escaped.join("|")})(?=$|[\\s.,;:!?¡¿'"()\\[\\]-])`, "gi");
}

function findMatches(text: string, regex: RegExp): string[] {
  const normalized = normalize(text);
  const hits = new Set<string>();
  let match: RegExpExecArray | null;
  // Always reset lastIndex because the regex is shared across calls.
  regex.lastIndex = 0;
  while ((match = regex.exec(normalized)) !== null) {
    hits.add(match[1]);
  }
  regex.lastIndex = 0;
  return [...hits];
}

function shortSample(text: string, max = 120): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

// ─────────────────────────────────────────────────────────────────────
// Term lists
// ─────────────────────────────────────────────────────────────────────

// Profanity (LatAm + peninsular). Kept conservative — we're after
// overt vulgarity, not mild fillers. Chilean "weon/weón" is common
// but not always offensive; included because repeated use inside a
// clinical context IS worth flagging.
const PROFANITY_TERMS = [
  "mierda", "mierdas",
  "puta", "putas", "puto", "putos",
  "puteada", "putear",
  "cagada", "cagadas", "cagao", "cagon",
  "carajo", "carajos",
  "coño", "cono",
  "joder", "jodida", "jodido",
  "pendejo", "pendeja", "pendejos", "pendejas",
  "verga", "vergas",
  "culo", "culos",
  "chucha", "chuchada",
  "conchetumadre", "conchesumadre",
  "ctm", "csm", "rctm",
  "weon", "weona", "weones", "weonas", "wn",
  "huevon", "huevona", "hueva",
  "boludo", "boluda", "pelotudo", "pelotuda",
  "cabron", "cabrona",
  "cojones",
];

// Violence ideation / threats. Detection of verbs that indicate
// intent or description of violent action. Context determines whether
// it is clinical material (patient talking about past abuse) or real
// threat from the user.
const VIOLENCE_TERMS = [
  "matar", "matarte", "matarla", "matarlo", "matarlos",
  "asesinar", "asesinato",
  "golpear", "golpearla", "golpearlo", "golpearte",
  "pegar", "pegarle", "pegarla", "pegarte",
  "apuñalar", "apunalar", "acuchillar",
  "violar", "violarla", "violarlo", "violarte",
  "torturar",
  "abusar", "abusador",
  "destruir", "destruirla", "destruirlo",
];

// Self-harm / suicide ideation. These fire CRITICAL when the source
// is the student (first-person real person) and HIGH when the source
// is the AI patient (first-person clinical role-play — still worth
// seeing, but expected in therapy simulation).
const SELF_HARM_TERMS = [
  "suicidio", "suicidarme", "suicidarse", "suicida",
  "matarme", "matarnos",
  "morirme", "quiero morir", "quisiera morir",
  "no quiero vivir", "no tiene sentido vivir", "no quiero seguir",
  "cortarme", "cortarse", "hacerme dano", "hacerme daño",
  "lastimarme", "lastimarse",
  "acabar con mi vida", "acabar con todo",
];

// Disrespect from the student toward the AI patient. These are
// low/medium severity — we're not looking for rudeness in isolation,
// we're looking for dismissive or demeaning speech that a supervisor
// would want to know about.
const DISRESPECT_TERMS = [
  "eres estupida", "eres estupido", "que estupida", "que estupido",
  "eres tonta", "eres tonto", "que tonta", "que tonto",
  "no sirves", "no vales nada",
  "idiota", "imbecil", "tarado", "tarada",
  "bruta", "bruto",
];

// Prompt leakage — the assistant emitted tokens that were supposed to
// stay in its internal reasoning (typically system-prompt scaffolding
// bleeding into the output). Observed failure modes include:
//   "SILENCIO INTERNO: …"
//   "[CONTEXTO TEMPORAL Y GEOGRÁFICO]"
//   "[REGLA CRÍTICA DE ROLES…]"
//   "[MEMORIA A LARGO PLAZO…]"
//   "[FIN MEMORIA]"
//   "[INSTRUCCIÓN]" / "[INSTRUCCIONES]"
//   "[SYSTEM]" / "SYSTEM:"
//   "[PROMPT]" or lines starting with "System:" / "Instruction:"
// These regexes run against the ORIGINAL casing of the text (not the
// normalized lowercase) because the scaffolding we're catching is
// specifically uppercase by convention.
const PROMPT_LEAK_REGEXES: RegExp[] = [
  /SILENCIO\s+INTERNO\s*:/g,
  /\[CONTEXTO\s+TEMPORAL/gi,
  /\[REGLA\s+CR[IÍ]TICA/gi,
  /\[MEMORIA\s+A\s+LARGO\s+PLAZO/gi,
  /\[FIN\s+MEMORIA\]/gi,
  /\[INSTRUCCI[OÓ]N(?:ES)?\s*(?:DEL\s+SISTEMA|INTERNA)?/gi,
  /\[SYSTEM\s*PROMPT/gi,
  /^\s*SYSTEM\s*:/gmi,
  /\[PROMPT\s*[:\]]/gi,
  /\[INICIO\s+DE\s+SESI[OÓ]N\s*—/gi,
  /\[REGLA\s+ANTI-REPETICI[OÓ]N/gi,
  /\[REGLA\s+DE\s+CONFIDENCIALIDAD/gi,
];

// ─────────────────────────────────────────────────────────────────────
// Pre-compiled regexes (one per category)
// ─────────────────────────────────────────────────────────────────────

const PROFANITY_RE = buildTermRegex(PROFANITY_TERMS);
const VIOLENCE_RE = buildTermRegex(VIOLENCE_TERMS);
const SELF_HARM_RE = buildTermRegex(SELF_HARM_TERMS);
const DISRESPECT_RE = buildTermRegex(DISRESPECT_TERMS);

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Inspect a single message and return zero or more alert specs. The
 * caller is responsible for persisting them to `chat_alerts` and for
 * acting on the `short_response` case (retry) — this function is pure.
 */
export function detectAlerts(
  text: string,
  source: AlertSource,
  turnNumber: number,
): AlertSpec[] {
  const alerts: AlertSpec[] = [];
  if (!text) return alerts;

  // 1. Short LLM response — only for assistant, only after turn 2
  //    (turns 1-2 have an intentional "respond in 3-5 words" rule).
  if (source === "assistant" && turnNumber > 2) {
    const trimmed = text.trim();
    if (trimmed.length < 15 && trimmed.split(/\s+/).length < 4) {
      alerts.push({
        kind: "short_response",
        severity: "medium",
        matchedTerms: `length=${trimmed.length}`,
        sample: shortSample(text),
      });
    }
  }

  // 2. Profanity (both sides)
  const profanityHits = findMatches(text, PROFANITY_RE);
  if (profanityHits.length > 0) {
    alerts.push({
      kind: "profanity",
      severity: source === "assistant" ? "high" : "medium",
      matchedTerms: profanityHits.join(", "),
      sample: shortSample(text),
    });
  }

  // 3. Violence (both sides)
  const violenceHits = findMatches(text, VIOLENCE_RE);
  if (violenceHits.length > 0) {
    alerts.push({
      kind: "violence",
      severity: source === "user" ? "high" : "medium",
      matchedTerms: violenceHits.join(", "),
      sample: shortSample(text),
    });
  }

  // 4. Self-harm / suicide ideation
  const selfHarmHits = findMatches(text, SELF_HARM_RE);
  if (selfHarmHits.length > 0) {
    alerts.push({
      kind: "self_harm",
      severity: source === "user" ? "critical" : "high",
      matchedTerms: selfHarmHits.join(", "),
      sample: shortSample(text),
    });
  }

  // 5. Disrespect — only applies to the student side (AI patient is
  //    scripted and unlikely to disrespect; profanity catches the rest).
  if (source === "user") {
    const disrespectHits = findMatches(text, DISRESPECT_RE);
    if (disrespectHits.length > 0) {
      alerts.push({
        kind: "disrespect",
        severity: "medium",
        matchedTerms: disrespectHits.join(", "),
        sample: shortSample(text),
      });
    }
  }

  // 6. Prompt leakage — only applies to the assistant side.
  if (source === "assistant") {
    const leakHits: string[] = [];
    for (const re of PROMPT_LEAK_REGEXES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        leakHits.push(m[0].trim());
        if (!re.global) break;
      }
      re.lastIndex = 0;
    }
    if (leakHits.length > 0) {
      alerts.push({
        kind: "prompt_leak",
        severity: "high",
        matchedTerms: leakHits.slice(0, 3).join(" | "),
        sample: shortSample(text),
      });
    }
  }

  return alerts;
}

/**
 * Strip prompt-leak scaffolding from an assistant message so the
 * cleaned version is what ends up persisted in `messages` and seen by
 * the student in future reviews. The raw text is still recoverable
 * from the alert record (via sample + matched_terms).
 *
 * Conservative: only removes obvious scaffolding headers and the
 * block that follows them up to the next blank line or bracketed
 * section. If unsure, leaves the text alone.
 */
export function stripPromptLeaks(text: string): { cleaned: string; changed: boolean } {
  if (!text) return { cleaned: text, changed: false };
  let cleaned = text;

  // 1. Remove "SILENCIO INTERNO: ... \n\n" blocks (possibly multiline
  //    until the next blank line).
  cleaned = cleaned.replace(/SILENCIO\s+INTERNO\s*:[^\n]*(?:\n(?!\s*\n)[^\n]*)*(?:\n\s*\n)?/gi, "");

  // 2. Remove standalone lines that start with a bracketed scaffolding
  //    tag we know about.
  const SCAFFOLD_LINE = /^[ \t]*\[(?:CONTEXTO\s+TEMPORAL|REGLA\s+CR[IÍ]TICA|MEMORIA\s+A\s+LARGO\s+PLAZO|FIN\s+MEMORIA|INSTRUCCI[OÓ]N(?:ES)?|SYSTEM\s*PROMPT|PROMPT\s*[:\]]|INICIO\s+DE\s+SESI[OÓ]N\s*—|REGLA\s+ANTI-REPETICI[OÓ]N|REGLA\s+DE\s+CONFIDENCIALIDAD)[^\]\n]*\][^\n]*$/gim;
  cleaned = cleaned.replace(SCAFFOLD_LINE, "");

  // 3. Remove leading "SYSTEM:" lines.
  cleaned = cleaned.replace(/^[ \t]*SYSTEM\s*:[^\n]*$/gim, "");

  // 4. Collapse multiple consecutive blank lines left by removals.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return { cleaned, changed: cleaned !== text };
}

// Public constant, also imported by the dashboard UI for filter pills.
export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  short_response: "Respuesta truncada",
  profanity: "Groserías",
  violence: "Violencia",
  self_harm: "Riesgo / autolesión",
  disrespect: "Falta de respeto",
  prompt_leak: "Fuga de prompt",
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};
