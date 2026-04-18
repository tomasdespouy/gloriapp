-- ============================================================
-- Migration: explicit status column on survey_responses
-- Date: 2026-04-18
--
-- Problem:
--   The survey modal's "Ahora no" button only toggled local React
--   state — it left no trace in the database. Superadmin therefore
--   could not distinguish three user groups:
--     (a) students who genuinely haven't seen the survey yet
--     (b) students who saw it and chose not to answer ("no realizada")
--     (c) students who responded in full
--   All three looked identical: no row in survey_responses.
--
-- Fix:
--   Add a NOT NULL status column with DEFAULT 'completed', constrained
--   to {'completed', 'not_taken'}. A row with status='not_taken' is a
--   persisted decline: the student pressed "No realizar", and we
--   record the intent so it can be counted separately from silent
--   non-respondents.
--
-- Compatibility:
--   • Every existing row becomes status='completed' automatically via
--     the DEFAULT — there are no legacy rows representing declines to
--     reclassify.
--   • answers / nps_score stay nullable, which is already required for
--     decline rows (answers=null, nps=null, status='not_taken').
--   • UNIQUE(survey_id, user_id) keeps holding, so a student cannot
--     decline then respond (or vice-versa) without admin intervention.
--     That's the intended semantic: "no realizar" is a deliberate act.
--
-- Reads:
--   • /api/admin/pilots/[id]/survey-responses filters status='completed'
--     so exports stay clean.
--   • /api/surveys/active keeps working unchanged — it checks for ANY
--     row in survey_responses to decide whether to suppress the modal,
--     which is the correct behavior for both completed and declined.
--
-- Rollback:
--   ALTER TABLE public.survey_responses DROP COLUMN status;
-- ============================================================

ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'not_taken'));

COMMENT ON COLUMN public.survey_responses.status IS
  'Intent of this row. ''completed'' = student filled the form (answers/nps populated). ''not_taken'' = student pressed the "No realizar" button (answers NULL). Defaults to ''completed'' so historical rows keep their semantics.';

CREATE INDEX IF NOT EXISTS survey_responses_status_idx
  ON public.survey_responses (status);
