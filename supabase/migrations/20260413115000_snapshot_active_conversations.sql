-- ============================================================
-- Migration: Snapshot prompts for all active/abandoned conversations
-- Date: 2026-04-13
--
-- Purpose:
--   Before updating legacy patient prompts, capture the CURRENT
--   system_prompt into every active/abandoned conversation so
--   in-progress sessions continue with the original behavior.
--
-- Safety:
--   - Only fills NULL prompt_snapshot (idempotent)
--   - Does not touch completed conversations
--   - Does not modify ai_patients
--
-- Rollback: UPDATE conversations SET prompt_snapshot = NULL
--           WHERE status IN ('active', 'abandoned');
-- ============================================================

UPDATE conversations c
SET prompt_snapshot = p.system_prompt
FROM ai_patients p
WHERE c.ai_patient_id = p.id
  AND c.status IN ('active', 'abandoned')
  AND c.prompt_snapshot IS NULL;
