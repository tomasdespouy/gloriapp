ALTER TABLE public.research_opportunities
  ADD COLUMN IF NOT EXISTS registration_cost TEXT,
  ADD COLUMN IF NOT EXISTS gloria_fit_summary TEXT;

-- Backfill: generate gloria_fit_summary from advantages + approach for existing rows
UPDATE public.research_opportunities
SET gloria_fit_summary = COALESCE(approach, '') || ' ' || COALESCE(array_to_string(advantages, '. '), '')
WHERE gloria_fit_summary IS NULL AND (approach IS NOT NULL OR advantages IS NOT NULL);
