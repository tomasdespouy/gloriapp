-- ============================================================
-- COMPETENCIES V2: 10 competencies (from UGM framework), scale 0-4
-- Old columns kept for backward compatibility with existing data
-- ============================================================

-- Domain 1: Session Structure (4 applicable to chat)
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS setting_terapeutico NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_consulta NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS datos_contextuales NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objetivos NUMERIC(2,1) DEFAULT 0;

-- Domain 2: Therapeutic Attitudes (6)
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS escucha_activa NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actitud_no_valorativa NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS optimismo NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presencia NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conducta_no_verbal NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contencion_afectos NUMERIC(2,1) DEFAULT 0;

-- New overall score on 0-4 scale
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS overall_score_v2 NUMERIC(2,1) DEFAULT 0;

-- Track which version was used for evaluation
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS eval_version INTEGER DEFAULT 1;
