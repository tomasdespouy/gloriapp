-- ============================================================
-- Sección de Investigación: oportunidades + papers
-- ============================================================

-- Oportunidades de conferencias/call-for-papers escaneadas
CREATE TABLE public.research_opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'conference'
                    CHECK (type IN ('conference', 'journal', 'call_for_papers', 'grant')),
  organizer       TEXT,
  deadline        DATE,
  event_date      TEXT,
  location        TEXT,
  url             TEXT,
  gloria_fit      TEXT NOT NULL DEFAULT 'medium'
                    CHECK (gloria_fit IN ('high', 'medium', 'low')),
  advantages      TEXT[],
  weaknesses      TEXT[],
  approach        TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'reviewing', 'preparing', 'submitted', 'accepted', 'rejected', 'skipped')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_opp_date ON public.research_opportunities(scan_date DESC);

-- Papers y presentaciones de GlorIA (base de conocimiento)
CREATE TABLE public.research_papers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'paper'
                    CHECK (type IN ('paper', 'presentation', 'poster', 'proposal', 'report')),
  authors         TEXT[],
  abstract        TEXT,
  venue           TEXT,
  date            DATE,
  file_url        TEXT,
  tags            TEXT[],
  content_summary TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.research_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages research" ON public.research_opportunities
  FOR ALL TO authenticated USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "Superadmin manages papers" ON public.research_papers
  FOR ALL TO authenticated USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');
