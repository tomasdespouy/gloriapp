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

export const PACING_PROFILES: Record<PacingProfileKey, PacingProfile> = {
  anxious_fast: {
    charDelayMs: 18,
    sentenceGapMinMs: 50,
    sentenceGapMaxMs: 150,
    thinkingMinMs: 500,
    thinkingMaxMs: 1500,
    thinkingCeilingMs: 800,
    silenceThresholdsMs: [45_000, 90_000, 150_000, 300_000],
  },
  conversational_medium: {
    charDelayMs: 28,
    sentenceGapMinMs: 150,
    sentenceGapMaxMs: 300,
    thinkingMinMs: 900,
    thinkingMaxMs: 2500,
    thinkingCeilingMs: 800,
    silenceThresholdsMs: [60_000, 120_000, 210_000, 300_000],
  },
  reflective_paused: {
    charDelayMs: 40,
    sentenceGapMinMs: 300,
    sentenceGapMaxMs: 600,
    thinkingMinMs: 2000,
    thinkingMaxMs: 4500,
    thinkingCeilingMs: 1200,
    silenceThresholdsMs: [75_000, 150_000, 240_000, 300_000],
  },
  depressive_slow: {
    charDelayMs: 45,
    sentenceGapMinMs: 400,
    sentenceGapMaxMs: 800,
    thinkingMinMs: 1500,
    thinkingMaxMs: 4000,
    thinkingCeilingMs: 1000,
    // Fewer nudges (3), still closes at 5 min globally
    silenceThresholdsMs: [90_000, 180_000, 300_000],
  },
  inhibited_timid: {
    charDelayMs: 38,
    sentenceGapMinMs: 200,
    sentenceGapMaxMs: 500,
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
