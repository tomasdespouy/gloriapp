-- ============================================================
-- Migration: track welcome video viewing server-side
-- Date: 2026-04-14
--
-- Rationale:
--   The onboarding video previously relied only on localStorage
--   (`gloria_welcome_seen[:{userId}]`). That breaks as soon as a
--   user switches browsers, clears storage, enters incognito, or
--   shares a machine with another account that saw it first —
--   which is exactly what happened in the pilot.
--
--   This column lets the server know definitively whether a given
--   user has seen the intro. localStorage stays as a fallback so
--   offline/ API-down cases still behave gracefully, but the
--   source of truth becomes the database.
--
-- Rollback: ALTER TABLE profiles DROP COLUMN welcome_video_seen_at;
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_video_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.welcome_video_seen_at IS
  'Timestamp of when the user dismissed the onboarding WelcomeVideoModal. Null = never seen. Set server-side via POST /api/profile/mark-welcome-seen.';
