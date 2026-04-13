-- ============================================================
-- Migration: Add per-pilot UI configuration
-- Date: 2026-04-13
--
-- Purpose:
--   Allow per-pilot feature flags that control the student
--   experience (hide modules, skip steps) without affecting
--   other pilots or the global platform.
--
-- Example config:
--   {
--     "hide_live_recording": true,
--     "hide_microlearning": true,
--     "skip_tutor_redirect": true,
--     "skip_self_reflection": true
--   }
--
-- Rollback: ALTER TABLE pilots DROP COLUMN ui_config;
-- ============================================================

ALTER TABLE pilots ADD COLUMN ui_config JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN pilots.ui_config IS
  'Per-pilot UI feature flags. Keys: hide_live_recording, hide_microlearning, skip_tutor_redirect, skip_self_reflection. Empty object = standard experience.';
