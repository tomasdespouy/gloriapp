-- ============================================================
-- Migration: per-user accessibility preferences
-- Date: 2026-04-14
--
-- Adds `a11y_prefs` JSONB to profiles so a user can set font size
-- and contrast once and have it follow them across devices, browsers
-- and sessions. Default {} = system defaults.
--
-- Expected keys (validated client-side, not enforced here):
--   fontSize: "m" | "l" | "xl"
--   contrast: "default" | "high"
--
-- Rollback: ALTER TABLE profiles DROP COLUMN a11y_prefs;
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS a11y_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.a11y_prefs IS
  'Accessibility preferences: fontSize ("m"|"l"|"xl"), contrast ("default"|"high"). Empty object = defaults.';
