-- ============================================================
-- Migration: make "pilot mode" the default experience for any
-- new pilot, and backfill existing pilots that still have an
-- empty ui_config.
-- Date: 2026-04-14
--
-- Rationale:
--   Pilots should ship with the reduced experience by default
--   (no live recording, no microlearning, skip tutor onboarding,
--   skip self-reflection form). Previously ui_config was
--   defaulted to '{}' and every pilot required a manual UPDATE,
--   which is how the 13-abr incident happened.
--
-- Effect:
--   - Pilots created from now on inherit the 4 flags automatically.
--   - Existing pilots whose ui_config is still the literal empty
--     object get the same flags applied. Pilots that already have
--     some flags set are left untouched (no jsonb merge override).
--
-- Rollback: ALTER TABLE pilots ALTER COLUMN ui_config SET DEFAULT '{}'::jsonb;
-- ============================================================

ALTER TABLE pilots
  ALTER COLUMN ui_config SET DEFAULT jsonb_build_object(
    'hide_live_recording', true,
    'hide_microlearning', true,
    'skip_tutor_redirect', true,
    'skip_self_reflection', true
  );

UPDATE pilots
SET ui_config = jsonb_build_object(
  'hide_live_recording', true,
  'hide_microlearning', true,
  'skip_tutor_redirect', true,
  'skip_self_reflection', true
)
WHERE ui_config = '{}'::jsonb;

COMMENT ON COLUMN pilots.ui_config IS
  'Per-pilot UI feature flags. Keys: hide_live_recording, hide_microlearning, skip_tutor_redirect, skip_self_reflection. Default: all true (pilot mode). Set individual keys to false to opt out.';
