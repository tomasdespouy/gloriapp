-- ============================================================
-- Migration: per-patient conversational pacing profile
-- Date: 2026-04-14
--
-- Adds `pacing_profile` to ai_patients so each AI patient can have
-- its own typing speed, thinking delay, and silence-nudge cadence.
-- Heuristic backfill classifies the existing 34 patients based on
-- keywords in their system_prompt + difficulty_level. Admins can
-- override via the patient editor afterwards.
--
-- Valid values (enforced by CHECK constraint):
--   anxious_fast, conversational_medium, reflective_paused,
--   depressive_slow, inhibited_timid
--
-- Rollback: ALTER TABLE ai_patients DROP COLUMN pacing_profile;
-- ============================================================

ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS pacing_profile TEXT;

ALTER TABLE public.ai_patients
  ADD CONSTRAINT ai_patients_pacing_profile_check
  CHECK (
    pacing_profile IS NULL OR pacing_profile IN (
      'anxious_fast',
      'conversational_medium',
      'reflective_paused',
      'depressive_slow',
      'inhibited_timid'
    )
  );

COMMENT ON COLUMN public.ai_patients.pacing_profile IS
  'Conversational pacing profile for streaming speed, thinking delay and silence-nudge cadence. NULL falls back to "conversational_medium" at runtime. See src/lib/conversation-pacing.ts.';

-- ─── Heuristic backfill ────────────────────────────────────────
-- Order matters: first rule that matches wins, so the most specific
-- traits are checked before the fallback. The system_prompt is
-- lowercased for case-insensitive matching without touching data.

-- Depressive / apathetic → slow
UPDATE public.ai_patients
SET pacing_profile = 'depressive_slow'
WHERE pacing_profile IS NULL
  AND (
    system_prompt ILIKE '%depresi%'
    OR system_prompt ILIKE '%apat%'
    OR system_prompt ILIKE '%desmotivad%'
    OR system_prompt ILIKE '%sin esperanza%'
    OR system_prompt ILIKE '%desganad%'
  );

-- Shy / inhibited / avoidant → timid
UPDATE public.ai_patients
SET pacing_profile = 'inhibited_timid'
WHERE pacing_profile IS NULL
  AND (
    system_prompt ILIKE '%tímid%'
    OR system_prompt ILIKE '%inhibid%'
    OR system_prompt ILIKE '%evitativ%'
    OR system_prompt ILIKE '%retraíd%'
    OR system_prompt ILIKE '%cauteloso%'
  );

-- Anxious + young → fast
UPDATE public.ai_patients
SET pacing_profile = 'anxious_fast'
WHERE pacing_profile IS NULL
  AND age IS NOT NULL AND age < 30
  AND (
    system_prompt ILIKE '%ansiedad%'
    OR system_prompt ILIKE '%p[aá]nico%'
    OR system_prompt ILIKE '%acelerad%'
    OR system_prompt ILIKE '%ansios%'
  );

-- Advanced cases → reflective/paused (deeper clinical work)
UPDATE public.ai_patients
SET pacing_profile = 'reflective_paused'
WHERE pacing_profile IS NULL
  AND difficulty_level = 'advanced';

-- Everyone else → conversational medium (safe default)
UPDATE public.ai_patients
SET pacing_profile = 'conversational_medium'
WHERE pacing_profile IS NULL;
