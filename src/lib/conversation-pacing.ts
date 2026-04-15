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
  },
  conversational_medium: {
    charDelayMs: 75, // ~27 cps / ~5.3 wps
    sentenceGapMinMs: 220,
    sentenceGapMaxMs: 420,
    thinkingMinMs: 900,
    thinkingMaxMs: 2500,
    thinkingCeilingMs: 800,
    silenceThresholdsMs: [60_000, 120_000, 210_000, 300_000],
  },
  reflective_paused: {
    charDelayMs: 110, // ~18 cps / ~3.6 wps
    sentenceGapMinMs: 400,
    sentenceGapMaxMs: 800,
    thinkingMinMs: 2000,
    thinkingMaxMs: 4500,
    thinkingCeilingMs: 1200,
    silenceThresholdsMs: [75_000, 150_000, 240_000, 300_000],
  },
  depressive_slow: {
    charDelayMs: 140, // ~14 cps / ~2.9 wps
    sentenceGapMinMs: 500,
    sentenceGapMaxMs: 1000,
    thinkingMinMs: 1500,
    thinkingMaxMs: 4000,
    thinkingCeilingMs: 1000,
    silenceThresholdsMs: [90_000, 180_000, 300_000],
  },
  inhibited_timid: {
    charDelayMs: 95, // ~21 cps / ~4.2 wps
    sentenceGapMinMs: 300,
    sentenceGapMaxMs: 650,
    thinkingMinMs: 1200,
    thinkingMaxMs: 3000,
    thinkingCeilingMs: 1000,
    silenceThresholdsMs: [90_000, 180_000, 300_000],
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
