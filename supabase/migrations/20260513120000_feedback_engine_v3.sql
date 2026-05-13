-- ============================================================
-- Feedback Engine V3
-- ============================================================
-- Mejora pedagógica del motor de retroalimentación:
--
--   P2  Distinguir "no aplicaba" (NULL) de "omitido" (0):
--       - NULL: la situación no requería esta competencia (justificado en na_justifications)
--       - 0   : el contexto la requería y el estudiante no la desplegó
--       - 1-4 : continuum de calidad (rúbrica conductual)
--
--   P4  Snapshot del output original del LLM (ai_original):
--       Permite analizar a posteriori el desacuerdo entre la evaluación
--       IA y la edición del docente. Métrica clave de calibración.
--
-- eval_version se mantiene en 2 para preservar compatibilidad con todos
-- los filtros existentes (.eq("eval_version", 2), etc). La rúbrica V3
-- se distingue por la presencia de ai_original.rubric_version = "v3.0"
-- y por na_justifications poblado.
--
-- Compatibilidad: las filas existentes (eval_version 1 ó 2) quedan
-- intactas. Los descriptores conductuales y la distinción NA/omitido
-- aplican solo a evaluaciones nuevas.
-- ============================================================

-- 1) Quitar DEFAULT 0 en las 10 columnas V2 para que NULL sea posible
--    y semánticamente distinto de 0. Las columnas no son NOT NULL,
--    por lo que basta con dropear el default.
ALTER TABLE public.session_competencies
  ALTER COLUMN setting_terapeutico DROP DEFAULT,
  ALTER COLUMN motivo_consulta DROP DEFAULT,
  ALTER COLUMN datos_contextuales DROP DEFAULT,
  ALTER COLUMN objetivos DROP DEFAULT,
  ALTER COLUMN escucha_activa DROP DEFAULT,
  ALTER COLUMN actitud_no_valorativa DROP DEFAULT,
  ALTER COLUMN optimismo DROP DEFAULT,
  ALTER COLUMN presencia DROP DEFAULT,
  ALTER COLUMN conducta_no_verbal DROP DEFAULT,
  ALTER COLUMN contencion_afectos DROP DEFAULT;

-- 2) Justificaciones para los casos marcados como "no aplicaba".
--    Shape: { "competency_key": "razón clínica del NA", ... }
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS na_justifications JSONB DEFAULT '{}'::jsonb;

-- 3) Snapshot del output completo del LLM al momento de generar la
--    evaluación. Inmutable después de la primera escritura.
--    Permite comparar ai_original.scores vs. campos actuales para
--    cuantificar el desacuerdo IA-docente.
--    Shape:
--      {
--        "scores":          {"setting_terapeutico": 3, "motivo_consulta": null, ...},
--        "overall_score_v2": 2.8,
--        "na_justifications": {...},
--        "commentary": "...",
--        "strengths": [...],
--        "areas_to_improve": [...],
--        "evidence":   {...},
--        "model":      "claude-opus-4-7" | "gpt-4o" | "gemini-2.5-flash",
--        "rubric_version": "v3.0",
--        "generated_at": "ISO-8601"
--      }
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS ai_original JSONB;

COMMENT ON COLUMN public.session_competencies.ai_original IS
  'Snapshot inmutable del output del LLM al crear la evaluación. Usado para medir desacuerdo IA-docente.';

COMMENT ON COLUMN public.session_competencies.na_justifications IS
  'Razones clínicas por las que cada competencia con score=NULL fue marcada como "no aplicaba". Shape: {competency_key: razón}';
