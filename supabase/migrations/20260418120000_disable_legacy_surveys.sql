-- ============================================================
-- Migration: retire legacy survey forms from circulation
-- Date: 2026-04-18
--
-- Problem:
--   Legacy surveys (form_version IS NULL, rendering the original UGM v1
--   questionnaire) remained flagged is_active=true while new pilots
--   were created with form_version='v2_pilot'. When both coexisted,
--   the student could end up seeing the old form depending on the
--   API's (previously non-deterministic) selection order. Even after
--   fixing the ordering, keeping legacy rows active leaves ambiguity.
--
-- Fix:
--   Flip is_active=false on every legacy row (form_version IS NULL).
--   This removes them from /api/surveys/active entirely (the endpoint
--   filters is_active=true + starts_at/ends_at windows), so they stop
--   competing for the student's slot. Historical survey_responses are
--   NOT touched — students who already answered v1 keep their answers
--   intact and admins can still read them via the export endpoints.
--
--   From this migration forward, new surveys must be created with
--   form_version='v2_pilot' (the pilot creation endpoint already does
--   this, and /api/admin/surveys POST now defaults to it too).
--
-- Compatibility:
--   • survey_responses: untouched (all historical rows preserved).
--   • surveys: only is_active flipped; schema unchanged.
--   • Admin dashboards that list all surveys keep working — they
--     don't filter by is_active, so the legacy rows remain visible
--     as "inactive" rather than disappearing.
--
-- Rollback (emergency only):
--   UPDATE public.surveys
--   SET is_active = true
--   WHERE form_version IS NULL;
-- ============================================================

UPDATE public.surveys
SET is_active = false
WHERE form_version IS NULL
  AND is_active = true;
