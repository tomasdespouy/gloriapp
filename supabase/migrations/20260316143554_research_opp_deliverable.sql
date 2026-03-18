ALTER TABLE public.research_opportunities
  ADD COLUMN IF NOT EXISTS deliverable TEXT;
