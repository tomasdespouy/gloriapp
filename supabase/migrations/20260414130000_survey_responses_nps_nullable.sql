-- ============================================================
-- Migration: make survey_responses.nps_score nullable
-- Date: 2026-04-14
--
-- Rationale:
--   The original survey schema was modeled after NPS (0-10) where
--   nps_score was the primary payload and marked NOT NULL. The
--   platform now uses a flexible JSONB `answers` column for
--   multi-question Microsoft-Form-style surveys (UGM evaluación
--   de plataforma), where nps_score is not used at all and is
--   sent as null. That insert was failing with SQLSTATE 23502.
--
-- Effect:
--   DROP NOT NULL on nps_score. Existing non-null values are left
--   intact. New rows can omit the field entirely.
--
-- Rollback:
--   UPDATE survey_responses SET nps_score = 0 WHERE nps_score IS NULL;
--   ALTER TABLE survey_responses ALTER COLUMN nps_score SET NOT NULL;
--   (rollback only safe if no rows have legitimate NULLs yet)
-- ============================================================

ALTER TABLE public.survey_responses
  ALTER COLUMN nps_score DROP NOT NULL;

COMMENT ON COLUMN public.survey_responses.nps_score IS
  'NPS score 0-10. Nullable: legacy NPS surveys populate this; newer JSONB-based surveys (UGM form) leave it null and store everything in answers.';
