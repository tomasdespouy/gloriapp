-- ============================================================
-- Migration: enrichment blocks schema (INF-2026-050)
-- Date: 2026-05-08
--
-- Adds 4 JSONB columns to ai_patients to store the enrichment blocks
-- generated for each patient (RED SOCIAL Y VÍNCULOS, LUGARES SIGNIFICATIVOS,
-- ESTADO CORPORAL Y RUTINA, FRASES TIPO QUE DICES). The legacy column
-- system_prompt is NOT modified — composition happens at runtime via
-- src/lib/build-system-prompt.ts so migration is reversible by simply
-- removing the columns.
--
-- Each block is a JSONB document of shape:
--   { "text": "BLOCK CONTENT...",
--     "version": 1,
--     "generated_by": "ai" | "human",
--     "generated_at": "2026-05-08T12:00:00Z",
--     "model": "gpt-4o" }
--
-- enrichment_history captures every approved version for rollback and audit.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.enrichment_history;
--   ALTER TABLE public.ai_patients
--     DROP COLUMN IF EXISTS enrichment_red_social,
--     DROP COLUMN IF EXISTS enrichment_lugares,
--     DROP COLUMN IF EXISTS enrichment_estado_corporal,
--     DROP COLUMN IF EXISTS enrichment_frases_tipo,
--     DROP COLUMN IF EXISTS enrichment_version,
--     DROP COLUMN IF EXISTS enrichment_approved_by,
--     DROP COLUMN IF EXISTS enrichment_approved_at;
-- ============================================================

ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS enrichment_red_social JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_lugares JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_estado_corporal JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_frases_tipo JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS enrichment_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ai_patients.enrichment_red_social IS
  'INF-050. Bloque RED SOCIAL Y VÍNCULOS — personajes secundarios con nombre y rol. Inyectado al system_prompt al runtime via src/lib/build-system-prompt.ts. NULL = no enriquecido.';
COMMENT ON COLUMN public.ai_patients.enrichment_lugares IS
  'INF-050. Bloque LUGARES SIGNIFICATIVOS — espacios físicos del día a día con detalle sensorial.';
COMMENT ON COLUMN public.ai_patients.enrichment_estado_corporal IS
  'INF-050. Bloque ESTADO CORPORAL Y RUTINA — sueño, apetito, vestimenta, energía. Coherente con motivo de consulta.';
COMMENT ON COLUMN public.ai_patients.enrichment_frases_tipo IS
  'INF-050. Bloque FRASES TIPO QUE DICES — 6-8 frases prototípicas en dialecto del país.';
COMMENT ON COLUMN public.ai_patients.enrichment_version IS
  'Counter that increases each time any block is updated. 0 = never enriched.';

-- ============================================================
-- TABLE: enrichment_history (versionado completo de cada bloque)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrichment_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  block_name      TEXT NOT NULL CHECK (block_name IN
                    ('red_social', 'lugares', 'estado_corporal', 'frases_tipo')),
  version         INTEGER NOT NULL,
  content         JSONB NOT NULL,
  generated_by    TEXT NOT NULL CHECK (generated_by IN ('ai', 'human')),
  approved_by     UUID REFERENCES public.profiles(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_history_patient
  ON public.enrichment_history(patient_id, block_name, version DESC);

ALTER TABLE public.enrichment_history ENABLE ROW LEVEL SECURITY;

-- Solo admin/instructor pueden leer el historial
CREATE POLICY "Admins read enrichment_history"
  ON public.enrichment_history FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

-- Solo service_role puede insertar (los endpoints API usan service role)
CREATE POLICY "Service role inserts enrichment_history"
  ON public.enrichment_history FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.enrichment_history IS
  'INF-050. Audit trail and rollback source for each enrichment block. Every approval creates a new row. Use ORDER BY version DESC LIMIT 1 to get the current version per (patient_id, block_name).';
