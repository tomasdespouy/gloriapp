-- Research Data Insights: auto-generated flashcards from platform data analysis
CREATE TABLE public.research_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('competencias', 'uso_plataforma', 'correlación', 'varianza', 'causalidad', 'tendencia', 'comparación')),
  hypothesis      TEXT NOT NULL,
  findings        TEXT NOT NULL,
  data_source     TEXT NOT NULL,
  sample_size     INTEGER,
  statistical_sig TEXT,
  suggested_venues TEXT[] DEFAULT '{}',
  suggested_paper_type TEXT CHECK (suggested_paper_type IN ('artículo', 'póster', 'ponencia', 'comunicación breve')),
  status          TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'revisado', 'en desarrollo', 'descartado', 'publicado')),
  priority        TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.research_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on research_insights"
  ON public.research_insights FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX idx_research_insights_category ON public.research_insights(category);
CREATE INDEX idx_research_insights_status ON public.research_insights(status);
