-- ============================================================================
-- Migration: Add new clinical reflection fields (v2 questions)
-- ============================================================================
-- Replaces 3 generic questions with 5 clinically-grounded ones:
--   1. alliance_framing    (Alianza y encuadre)
--   2. rupture_moment      (Momento de ruptura)
--   3. nonverbal_cues      (Conducta no verbal)
--   4. intervention_types  (Tipo de intervenciones)
--   5. clinical_hypothesis (Hipótesis clínica)
-- Old columns kept for backward compatibility with existing data.
-- ============================================================================

ALTER TABLE public.session_feedback
  ADD COLUMN IF NOT EXISTS alliance_framing    TEXT,
  ADD COLUMN IF NOT EXISTS rupture_moment      TEXT,
  ADD COLUMN IF NOT EXISTS nonverbal_cues      TEXT,
  ADD COLUMN IF NOT EXISTS intervention_types  TEXT,
  ADD COLUMN IF NOT EXISTS clinical_hypothesis TEXT;
