-- ============================================================
-- Migration: Add prompt_snapshot to conversations
-- Date: 2026-04-13
--
-- Purpose:
--   Pin the patient's system_prompt at conversation start so
--   mid-session prompt updates never change an active session's
--   behavior. NULL = legacy conversation (falls back to
--   ai_patients.system_prompt at query time).
--
-- Rollback: ALTER TABLE conversations DROP COLUMN prompt_snapshot;
-- ============================================================

ALTER TABLE conversations ADD COLUMN prompt_snapshot TEXT;

COMMENT ON COLUMN conversations.prompt_snapshot IS
  'Snapshot of ai_patients.system_prompt captured when the conversation was created or first resumed. NULL for pre-migration conversations (fallback to ai_patients).';
