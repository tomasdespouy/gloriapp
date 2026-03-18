-- Add evidence column to session_competencies
-- Stores per-competency textual evidence from the transcript
ALTER TABLE session_competencies ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT NULL;
-- Format: { "escucha_activa": { "quote": "...", "turn": 5, "type": "validacion_empatica" }, ... }
