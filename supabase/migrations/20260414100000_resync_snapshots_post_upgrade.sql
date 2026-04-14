-- ============================================================
-- Migration: Re-sync prompt_snapshot for active/abandoned
-- conversations of the 5 legacy patients that were upgraded
-- in migration 20260413120000_upgrade_legacy_patients.sql.
-- Date: 2026-04-14
--
-- Problem:
--   Migration 20260413115000_snapshot_active_conversations.sql
--   ran BEFORE the patient upgrade, so snapshots captured the
--   legacy prompts (which included chilean vulgarisms for some
--   patients like Marcos). The runtime prefers the snapshot over
--   ai_patients.system_prompt, so in-progress pilot sessions
--   kept serving the old prompt even after the upgrade and the
--   content-safety layer was added.
--
-- Fix:
--   Overwrite prompt_snapshot with the CURRENT (upgraded) prompt
--   ONLY for active/abandoned conversations of those 5 patients.
--   Completed conversations are left untouched so historical
--   records remain faithful to what happened at the time.
--
-- Rollback: none needed — the previous snapshots are no longer
-- trusted. If necessary, restore from backup.
-- ============================================================

UPDATE conversations c
SET prompt_snapshot = p.system_prompt
FROM ai_patients p
WHERE c.ai_patient_id = p.id
  AND c.status IN ('active', 'abandoned')
  AND (
    (p.name = 'Lucía Mendoza' AND p.difficulty_level = 'beginner') OR
    (p.name = 'Marcos Herrera' AND p.difficulty_level = 'intermediate') OR
    (p.name = 'Diego Fuentes' AND p.difficulty_level = 'intermediate') OR
    (p.name = 'Carmen Torres' AND p.difficulty_level = 'advanced') OR
    (p.name = 'Roberto Salas' AND p.difficulty_level = 'beginner')
  );
