ALTER TABLE public.research_opportunities
  ADD COLUMN IF NOT EXISTS indexing TEXT;

-- Clean up entries with "buscar" as URL (these are AI-fabricated)
UPDATE public.research_opportunities SET url = NULL WHERE url = 'buscar';
