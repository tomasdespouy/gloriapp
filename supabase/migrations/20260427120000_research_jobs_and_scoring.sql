-- ============================================================
-- Research jobs (async Deep Research) + scoring columns
-- ============================================================

-- 1. research_jobs: trackea jobs asincronos de OpenAI Deep Research
--    Patron: cron 1 crea response (background) -> guarda response_id ->
--            cron 2 hace polling cada 15min hasta status=completed -> procesa.
CREATE TABLE public.research_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id         TEXT UNIQUE NOT NULL,
  model               TEXT NOT NULL,
  scan_type           TEXT NOT NULL DEFAULT 'mixed'
                        CHECK (scan_type IN ('mixed', 'conferences', 'funds')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
  trigger_source      TEXT NOT NULL DEFAULT 'cron'
                        CHECK (trigger_source IN ('cron', 'manual')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT,
  opportunities_count INTEGER DEFAULT 0,
  email_sent_at       TIMESTAMPTZ,
  raw_summary         TEXT,
  citations           JSONB DEFAULT '[]'::jsonb,
  poll_attempts       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_jobs_status ON public.research_jobs(status, started_at DESC);
CREATE INDEX idx_research_jobs_response ON public.research_jobs(response_id);

ALTER TABLE public.research_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages research jobs" ON public.research_jobs
  FOR ALL TO authenticated USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- 2. Nuevas columnas en research_opportunities para scoring multidimensional
--    fit (alineacion con GlorIA) ya existe. Agregamos:
--      - success_probability (0-100): chance estimada de ser aceptado/ganar
--      - application_difficulty (low/medium/high): esfuerzo requerido
--      - probability_reason / difficulty_reason: justificacion
ALTER TABLE public.research_opportunities
  ADD COLUMN IF NOT EXISTS success_probability INTEGER
    CHECK (success_probability IS NULL OR (success_probability >= 0 AND success_probability <= 100)),
  ADD COLUMN IF NOT EXISTS application_difficulty TEXT
    CHECK (application_difficulty IS NULL OR application_difficulty IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS probability_reason TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES public.research_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_research_opp_deadline ON public.research_opportunities(deadline)
  WHERE deadline IS NOT NULL;
