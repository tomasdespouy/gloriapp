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
  "no quiero vivir", "no tiene sentido vivir",
  // "no quiero seguir" a secas daba falsos positivos ("no quiero seguir
  // con esto/la sesión"). Exigimos contexto vital.
  "no quiero seguir viviendo", "no quiero seguir vivo", "no quiero seguir aca",
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

  // 1. Short LLM response — only for assistant, only after turn 2.
  //    Uses isLikelyTruncated() so a closed-off patient replying
  //    "Sí, doctorita." or "[asiente]" is NOT flagged — we only
  //    catch genuine cuts like "Mi" or "[Se enc" or "Ah, los ch".
  if (source === "assistant" && turnNumber > 2) {
    const truncCheck = isLikelyTruncated(text);
    if (truncCheck.truncated) {
      alerts.push({
        kind: "short_response",
        severity: "medium",
        matchedTerms: `truncated: ${truncCheck.reason}`,
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

// ─────────────────────────────────────────────────────────────────────
// Session rupture — directed hostility that should END the session
// ─────────────────────────────────────────────────────────────────────
//
// Distinct from the observational alerts above: this detects hostility
// aimed AT the patient (a real threat or insult from the student), which
// a human patient would not tolerate. The route uses it to make the
// patient withdraw and close the session.
//
// Scoped to SECOND-PERSON, patient-directed hostility ("te voy a matar",
// "eres un idiota") so it does NOT fire on legitimate clinical content
// the patient recounts in third person ("su esposo la quiso matar").

const DIRECTED_THREAT_RE =
  /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;

export type RuptureCheck = { rupture: boolean; reason: string };

/**
 * Detects student→patient hostility severe enough to rupture the session.
 * Returns { rupture, reason }. Pure; the caller decides what to do.
 *
 * Triggers on:
 *   1. Directed violent threats in 2nd person ("te voy a matar").
 *   2. Direct insults/disrespect toward the patient (reuses the
 *      disrespect term list — "eres un idiota", "no sirves").
 */
export function detectSessionRupture(text: string): RuptureCheck {
  if (!text) return { rupture: false, reason: "" };

  const normalized = normalize(text);
  DIRECTED_THREAT_RE.lastIndex = 0;
  const threat = normalized.match(DIRECTED_THREAT_RE);
  if (threat) return { rupture: true, reason: `directed_threat: ${threat[0].trim()}` };

  const disrespect = findMatches(text, DISRESPECT_RE);
  if (disrespect.length > 0) return { rupture: true, reason: `disrespect: ${disrespect.join(", ")}` };

  return { rupture: false, reason: "" };
}

// ─────────────────────────────────────────────────────────────────────
// Conducta ANTIPROFESIONAL del terapeuta (distinta de la hostilidad)
// ─────────────────────────────────────────────────────────────────────
//
// Aquí el terapeuta NO agrede al paciente, pero rompe el encuadre: se
// declara no apto, invierte roles (te pide ayuda a TI), conducta
// inapropiada, o te trata como si no fueras una persona real (IA/robot).
// Alimenta un contador; según el nivel del paciente primero se ADVIERTE y
// luego el paciente se RETIRA (por pérdida de confianza, no por miedo).
export type UnprofessionalCategory =
  | "not_human" | "not_fit" | "role_reversal" | "inappropriate" | "negligence";

// Regex de ALTA PRECISIÓN (corren sobre texto normalizado SIN tildes). Se
// tuvieron que endurecer para no marcar lenguaje terapéutico legítimo: p.ej.
// "quieres probar una técnica", "ayúdame a entender", "tu pasado", "el programa
// de tratamiento", "no eres una persona que merezca esto" NO deben disparar.
const UNPROF_REGEXES: { cat: UnprofessionalCategory; re: RegExp }[] = [
  // Te trata como IA/robot/no-humano.
  { cat: "not_human", re: /\beres\s+(una?\s+)?(ia|inteligencia artificial|maquina|robot|bot|chatbot|chat ?gpt|algoritmo)\b|\b(no eres|no sos)\s+(real|human[oa]|de verdad)\b|\bhablando con\s+(una?\s+)?(maquina|computadora|ia|robot|bot|inteligencia artificial)\b|\besto es\s+(un|una)\s+(bot|simulacion|inteligencia artificial|ia)\b/ },
  // Terapeuta se declara no apto (drogado/borracho/en crisis).
  { cat: "not_fit", re: /\b(soy|estoy)\s+(un[oa]?\s+)?(drogadicto|adicto|alcoholic[oa]|borrach[oa])\b|\bestoy\s+(muy\s+|bien\s+|super\s+)?(drogad[oa]|borrach[oa]|fumad[oa]|en crisis)\b|\bme\s+(voy a\s+|quiero\s+)?(lio|liar|armo|armar|fumar)\b[^.?!]{0,10}\b(porro|troncho|churro|coca|mota|hierba|marihuana)\b/ },
  // Inversión de rol: te pide ayuda/consejo a TI (sobre lo suyo).
  { cat: "role_reversal", re: /\bque (deberia|debo|puedo|tendria que) hacer yo\b|\bque harias\s+(tu\s+)?en mi lugar\b|\b(dame|deme)\s+(un\s+)?consejo\b|\baconsejame\b|\btu que (me )?(aconsejas|recomiendas|dirias)\b|\bayudame\s+(a mi|con mi|con mis)\b/ },
  // Conducta inapropiada: ofrece drogas/alcohol/encuentro, insinuación,
  // proselitismo o pide datos personales.
  { cat: "inappropriate", re: /\b(quieres|quiere|gustas|te (invito|ofrezco))\b[^.?!]{0,15}\b(un porro|fumar (un|hierba|mota|marihuana)|cocaina|una raya|un pase|un trago|una copa|una chela|salir conmigo|a mi casa|ir a tomar)\b|\beres (muy )?(guap[oa]|sexy|atractiv[oa])\b|\b(dame|deme|pasame) (tu|su) (numero|telefono|whatsapp|instagram)\b/ },
  // Negligencia clara.
  { cat: "negligence", re: /\bno estoy (capacitad[oa]|preparad[oa]|calificad[oa])\b|\bno soy (el|la) (indicad[oa]|adecuad[oa])\b|\b(mejor )?(ve|anda|vaya) con otr[oa] (profesional|terapeuta|psicolog[oa]|colega)\b/ },
];

/** Detecta conducta antiprofesional en un mensaje del terapeuta. */
export function detectUnprofessional(text: string): UnprofessionalCategory | null {
  if (!text) return null;
  const n = normalize(text);
  for (const { cat, re } of UNPROF_REGEXES) {
    if (re.test(n)) return cat;
  }
  return null;
}

// Paciencia por nivel: se AVISA al llegar a `warn` y se RETIRA en `leave`.
const UNPROF_THRESHOLDS: Record<string, { warn: number; leave: number }> = {
  beginner: { warn: 3, leave: 4 }, principiante: { warn: 3, leave: 4 },
  intermediate: { warn: 2, leave: 3 }, intermedio: { warn: 2, leave: 3 },
  advanced: { warn: 1, leave: 2 }, avanzado: { warn: 1, leave: 2 },
};

export type UnprofessionalVerdict = {
  action: "none" | "warn" | "withdraw";
  count: number;
  category: UnprofessionalCategory | null;
};

/** Evalúa TODOS los mensajes del terapeuta y decide advertir/retirar según nivel. */
export function evaluateUnprofessional(
  therapistMessages: string[],
  difficulty: string | null | undefined,
): UnprofessionalVerdict {
  let count = 0;
  let category: UnprofessionalCategory | null = null;
  for (const m of therapistMessages) {
    const cat = detectUnprofessional(m);
    if (cat) { count++; category = cat; }
  }
  const th = UNPROF_THRESHOLDS[(difficulty || "intermediate").toLowerCase()] || UNPROF_THRESHOLDS.intermediate;
  const action = count >= th.leave ? "withdraw" : count >= th.warn ? "warn" : "none";
  return { action, count, category };
}

// ─────────────────────────────────────────────────────────────────────
// Truncation heuristic — detects "obvious cuts", not short responses
// ─────────────────────────────────────────────────────────────────────
//
// A closed-off patient legitimately replies "Sí, doctorita.",
// "[asiente]", "Mmm, capaz.", "No." — all short, all valid. We only
// want to catch responses that are genuinely unfinished mid-word or
// mid-structure, like "Mi", "[Se enc", "Ah, los ch", "…".
//
// Rules (ordered, first hit wins):
//   (a) empty / whitespace-only                                → truncated
//   (b) unbalanced brackets [...] or parentheses (...)          → truncated
//   (c) ends with , : ;                                        → truncated
//   (d) in the short-valid whitelist ("sí", "no", "mmm"…)      → NOT truncated
//   (e) only an enclosed action like "[asiente levemente]"      → NOT truncated
//   (f) ends with . ! ? … ) ]                                   → NOT truncated
//   (g) single word (no spaces), not in whitelist, no punctuation → truncated
//   (h) short (<30 chars) without terminal punctuation, not
//       whitelisted                                             → truncated
//   (i) anything else                                           → NOT truncated

const SHORT_VALID_RESPONSES = new Set([
  "si", "no",
  "claro", "quizas", "tal vez", "capaz", "puede ser", "a veces",
  "nunca", "siempre",
  "mmm", "mm", "eh", "uhm", "uh", "aja", "ya", "okay", "ok",
  "bueno", "pues", "cierto", "verdad", "exacto",
  "entiendo", "gracias", "igual", "igualmente",
  "claro que si", "claro que no",
]);

export type TruncationCheck = {
  truncated: boolean;
  /** Machine-readable reason when truncated: "empty",
      "unbalanced_bracket", "unbalanced_paren", "ends_with_separator",
      "single_short_word_no_punct", "short_no_terminator". Undefined
      when not truncated. Surfaced in the chat_alerts table. */
  reason?: string;
};

/**
 * Decide whether an assistant message looks genuinely cut off (as in
 * a truncated stream). Tuned for Spanish therapy dialogue — a quiet
 * patient replying "Sí." or "[suspira]" is considered intact; a
 * response ending mid-word like "Mi" or "[Se enc" is flagged.
 */
export function isLikelyTruncated(text: string): TruncationCheck {
  if (!text) return { truncated: true, reason: "empty" };

  const trimmed = text.trim();
  if (trimmed.length === 0) return { truncated: true, reason: "whitespace_only" };

  // (b) Unbalanced brackets / parens — strong signal of cut mid-action.
  const open = (trimmed.match(/\[/g) || []).length;
  const close = (trimmed.match(/\]/g) || []).length;
  if (open !== close) return { truncated: true, reason: "unbalanced_bracket" };

  const pOpen = (trimmed.match(/\(/g) || []).length;
  const pClose = (trimmed.match(/\)/g) || []).length;
  if (pOpen !== pClose) return { truncated: true, reason: "unbalanced_paren" };

  const lastChar = trimmed[trimmed.length - 1];

  // (c) Ends with separator (, : ;) — never a valid sentence ending.
  if (/[,;:]/.test(lastChar)) return { truncated: true, reason: "ends_with_separator" };

  // Compute normalized form for whitelist comparison: lowercase, no
  // diacritics, stripped punctuation.
  const normalized = normalize(trimmed)
    .replace(/[.,;:!?¡¿"'()[\]…-]/g, "")
    .trim();

  // (d) Exact match against short-valid whitelist (including combos).
  if (SHORT_VALID_RESPONSES.has(normalized)) {
    return { truncated: false };
  }

  // (e) Only an enclosed action? E.g. "[asiente]" or "[mira hacia abajo]".
  if (/^\[[^\]]+\]\s*$/.test(trimmed)) {
    return { truncated: false };
  }

  // (f) Ends with valid terminator → accept.
  if (/[.!?…)\]]/.test(lastChar)) {
    return { truncated: false };
  }

  // Remaining branch: ends in a letter (no terminator), not whitelisted.
  const wordCount = trimmed.split(/\s+/).length;

  // (g) Single short word, no punctuation: classic truncation ("Mi").
  if (wordCount === 1 && trimmed.length < 6) {
    return { truncated: true, reason: "single_short_word_no_punct" };
  }

  // (h) Short utterance without a terminator: "Ah, los ch", "Mi mamá",
  //     "Bueno pues".
  if (trimmed.length < 30) {
    return { truncated: true, reason: "short_no_terminator" };
  }

  // (i) Long enough to be a real response even without a period at the
  //     end. Accept — model just forgot the period.
  return { truncated: false };
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
