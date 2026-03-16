-- Migration: Add patient creation workflow fields
-- Supports the 15-step patient creation process

ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS short_narrative JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS extended_narrative JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS coherence_review JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS projections JSONB;
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS creation_step INTEGER DEFAULT 0;

COMMENT ON COLUMN ai_patients.short_narrative IS 'Relato estructurado corto del paciente (paso 2-3)';
COMMENT ON COLUMN ai_patients.extended_narrative IS 'Relato extenso ~10 paginas por secciones (paso 4-6)';
COMMENT ON COLUMN ai_patients.coherence_review IS 'Resultado de revision de coherencia interna y clinica (paso 5)';
COMMENT ON COLUMN ai_patients.projections IS 'Proyecciones de 8 sesiones x 3 niveles (paso 7-8)';
COMMENT ON COLUMN ai_patients.creation_step IS 'Paso actual en el flujo de creacion (0-11)';
