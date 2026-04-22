-- ============================================================
-- MANUAL SEED — activate v2_pilot survey for an existing pilot.
-- Date: 2026-04-16
--
-- Run this AFTER the migration 20260416120000_surveys_form_version.sql
-- has been applied in production.
--
-- This script does two things for a given pilot:
--   1) Deactivates the legacy (form_version IS NULL) survey so that
--      no new user sees it.
--   2) Creates a new active survey row with form_version='v2_pilot'
--      bound to the same pilot_id. New pilot users will see this one.
--
-- Users who already answered the legacy survey are NOT re-prompted:
-- /api/surveys/active filters out surveys of the same pilot_id once
-- the user has answered any of them. Their historical row in
-- survey_responses stays exactly as it is.
--
-- How to run:
--   Replace <PILOT_ID> with the uuid of the target pilot. You can
--   find it with:
--     SELECT id, name, institution FROM pilots WHERE ends_at > NOW();
--
-- Rollback:
--   UPDATE surveys SET is_active=false WHERE form_version='v2_pilot' AND pilot_id='<PILOT_ID>';
--   UPDATE surveys SET is_active=true  WHERE form_version IS NULL    AND pilot_id='<PILOT_ID>';
-- ============================================================

BEGIN;

-- 1) Deactivate the legacy survey(s) for this pilot.
UPDATE public.surveys
   SET is_active = false
 WHERE pilot_id = '<PILOT_ID>'
   AND (form_version IS NULL);

-- 2) Create the new v2_pilot survey inheriting scope/fechas of the pilot.
--    Uses the pilot's establishment as scope and extends ends_at by 7d
--    from the pilot's ends_at, matching the convention in
--    src/app/api/admin/pilots/route.ts.
INSERT INTO public.surveys (
  title, scope_type, scope_id, pilot_id, starts_at, ends_at, is_active, form_version, created_at
)
SELECT
  'Experiencia ' || p.name || ' — ' || p.institution || ' (v2)',
  'establishment',
  p.establishment_id::TEXT,
  p.id,
  NOW(),
  COALESCE(p.ended_at + INTERVAL '7 days', NOW() + INTERVAL '90 days'),
  TRUE,
  'v2_pilot',
  NOW()
FROM public.pilots p
WHERE p.id = '<PILOT_ID>';

COMMIT;
