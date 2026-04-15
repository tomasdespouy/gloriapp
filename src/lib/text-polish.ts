/**
 * Conservative polishing + anomaly detection for patient LLM output.
 *
 * Goal: fix the kind of glitches that look obviously broken to a user
 * (tokens glued together like "ahoraSí", dangling brackets, control
 * chars) without turning the output into academic Spanish.
 *
 * Everything here is designed to be a no-op 99% of the time and to
 * never throw — if a regex trips, the original text passes through.
 */

import { logger } from "@/lib/logger";

/** Acronyms and brand names that legitimately contain internal caps.
    If a match falls on one of these, the gluing fix leaves it alone. */
const WHITELIST = [
  "GlorIA",
  "IA",
  "UGM",
  "UST",
  "UDP",
  "USS",
  "USACH",
  "UC",
  "PUC",
  "UANDES",
  "UCM",
  "UBO",
  "DSM",
  "DSM-5",
  "APA",
  "CIE",
  "CIE-10",
  "CIE-11",
  "TOC",
  "TDA",
  "TDAH",
  "TEPT",
  "TLP",
  "CBT",
  "TCC",
  "ABA",
  "DBT",
  "EMDR",
  "ACT",
  "TCA",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compile once — used on every LLM response
const WHITELIST_RE = new RegExp(
  `\\b(?:${WHITELIST.map(escapeRegex).join("|")})\\b`,
  "g",
);

/** Pattern that catches the glue glitch: lowercase letter directly
    followed by an uppercase letter inside the same "word". */
const GLUE_RE = /([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g;

/**
 * Inserts a space wherever a lowercase→uppercase boundary is missing,
 * unless the boundary falls inside a whitelisted acronym/brand.
 *
 * Returns the fixed text and whether anything changed.
 */
export function fixTokenGluing(text: string): { fixed: string; changed: boolean } {
  try {
    if (!text || !GLUE_RE.test(text)) {
      // Reset lastIndex since .test() with /g mutates it
      GLUE_RE.lastIndex = 0;
      return { fixed: text, changed: false };
    }
    GLUE_RE.lastIndex = 0;

    // 1. Mask whitelist tokens so the glue regex can't split them
    const masked: string[] = [];
    const maskedText = text.replace(WHITELIST_RE, (m) => {
      masked.push(m);
      return `\u0001${masked.length - 1}\u0001`;
    });

    // 2. Apply the space fix on the masked text
    const spaced = maskedText.replace(GLUE_RE, "$1 $2");

    // 3. Unmask
    const result = spaced.replace(/\u0001(\d+)\u0001/g, (_, idx) => {
      const token = masked[Number(idx)];
      return token ?? "";
    });

    return { fixed: result, changed: result !== text };
  } catch {
    // Never let polish break the response
    return { fixed: text, changed: false };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Anomaly detection (logged, does NOT modify text)
// ═══════════════════════════════════════════════════════════════════

export type AnomalyKind =
  | "glued_tokens"
  | "unclosed_bracket"
  | "weird_unicode"
  | "repeated_whitespace";

export type Anomaly = {
  kind: AnomalyKind;
  sample: string;
};

function sampleAround(text: string, idx: number, before = 20, after = 40): string {
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + after);
  return text.slice(start, end);
}

export function detectAnomalies(text: string): Anomaly[] {
  const out: Anomaly[] = [];
  try {
    if (!text) return out;

    // Glue token
    const glueMatch = /([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/.exec(text);
    if (glueMatch) {
      out.push({
        kind: "glued_tokens",
        sample: sampleAround(text, glueMatch.index, 20, 40),
      });
    }

    // Unbalanced brackets (common when the LLM cuts mid-stage-direction)
    const opens = (text.match(/\[/g) || []).length;
    const closes = (text.match(/\]/g) || []).length;
    if (opens !== closes) {
      out.push({
        kind: "unclosed_bracket",
        sample: text.slice(0, 80),
      });
    }

    // Control chars + replacement char (token-level corruption)
    const weirdMatch = /[\u0000-\u0008\u000E-\u001F\uFFFD]/.exec(text);
    if (weirdMatch) {
      out.push({
        kind: "weird_unicode",
        sample: sampleAround(text, weirdMatch.index, 20, 40),
      });
    }

    // Three or more consecutive spaces usually means a stitching bug
    if (/ {3,}/.test(text)) {
      out.push({
        kind: "repeated_whitespace",
        sample: text.slice(0, 80),
      });
    }
  } catch {
    // Never throw from observability
  }
  return out;
}

/**
 * One-shot polish: runs the fixer, logs anomalies against the final
 * text (whether we ended up fixing them or not). Intended to be called
 * once per LLM completion, server-side.
 */
export function polishAndLog(
  text: string,
  ctx: { conversationId?: string; patientId?: string; turn?: number },
): string {
  const { fixed, changed } = fixTokenGluing(text);
  const anomalies = detectAnomalies(fixed);

  if (anomalies.length > 0 || changed) {
    for (const a of anomalies) {
      logger.warn("text_anomaly", {
        kind: a.kind,
        sample: a.sample,
        fixed: changed && a.kind === "glued_tokens",
        ...ctx,
      });
    }
    // Log the glue fix on its own even if the anomaly was "resolved"
    if (changed && !anomalies.some((a) => a.kind === "glued_tokens")) {
      logger.warn("text_anomaly", {
        kind: "glued_tokens",
        sample: text.slice(0, 80),
        fixed: true,
        ...ctx,
      });
    }
  }

  return fixed;
}
