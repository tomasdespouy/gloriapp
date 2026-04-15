-- ============================================================
-- Migration: scope auto-created surveys to a specific pilot
-- Date: 2026-04-14
--
-- Problem:
--   When a pilot is created, POST /api/admin/pilots auto-creates a
--   survey with scope_type='establishment' + scope_id=establishment.
--   That survey becomes visible to EVERY user of that establishment
--   who has at least one evaluated session — including users who are
--   NOT participants of the pilot. They see the pilot's survey as if
--   they were in the pilot.
--
-- Fix:
--   Add a nullable `pilot_id` column to surveys. When set, the survey
--   is only offered to users who are members of that pilot's
--   pilot_participants row. Legacy non-pilot surveys (pilot_id NULL)
--   keep the old establishment/global behavior.
--
-- Rollback: ALTER TABLE surveys DROP COLUMN pilot_id;
-- ============================================================

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS pilot_id UUID REFERENCES public.pilots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surveys_pilot_id
  ON public.surveys(pilot_id)
  WHERE pilot_id IS NOT NULL;

COMMENT ON COLUMN public.surveys.pilot_id IS
  'When set, this survey is only applicable to participants of that pilot. Enforced at /api/surveys/active. NULL = legacy scope (global/establishment/country/course/section).';
