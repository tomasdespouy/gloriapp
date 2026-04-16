-- ============================================================
-- Migration: version the survey form schema per-row
-- Date: 2026-04-16
--
-- Problem:
--   Pilots need a new evaluation form (usabilidad + realismo clínico +
--   pertinencia cultural + diseño técnico + satisfacción + 5 preguntas
--   abiertas) for newly enrolled pilot users, but legacy users who
--   already answered the old form must keep their historical responses
--   intact and must NOT be re-prompted with the new questionnaire.
--
-- Fix:
--   Add an ADDITIVE, NULLABLE column `form_version` to `surveys`. A
--   row with `form_version IS NULL` renders the legacy questionnaire
--   (backward-compatible default). A row with `form_version='v2_pilot'`
--   renders the new pilot v2 questionnaire in SurveyModal.
--
--   Coexistence strategy:
--     • Legacy rows stay exactly as they are (NULL).
--     • New surveys for pilots can be seeded with 'v2_pilot'.
--     • /api/surveys/active suppresses pilot-scoped surveys for users
--       who already answered ANY other survey in the same pilot, so
--       veteran pilot participants don't get re-prompted.
--     • survey_responses.answers JSONB keeps its flexible shape; new
--       keys land under their own survey_id so reports can segment by
--       survey_id.
--
-- Compatibility:
--   • No existing row is modified.
--   • No foreign key is changed.
--   • Reads that don't SELECT form_version see no difference.
--
-- Rollback:
--   ALTER TABLE public.surveys DROP COLUMN form_version;
-- ============================================================

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS form_version TEXT NULL;

COMMENT ON COLUMN public.surveys.form_version IS
  'Identifies which questionnaire template the SurveyModal should render. NULL = legacy (UGM v1 form). ''v2_pilot'' = 2026-04 pilot v2 questionnaire (usabilidad + realismo + pertinencia + diseño + satisfacción + 5 abiertas).';
