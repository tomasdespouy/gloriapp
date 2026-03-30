-- Add reference paper fields and new categories to research_insights

-- Add reference paper columns
ALTER TABLE public.research_insights
  ADD COLUMN IF NOT EXISTS reference_title TEXT,
  ADD COLUMN IF NOT EXISTS reference_authors TEXT,
  ADD COLUMN IF NOT EXISTS reference_year INTEGER,
  ADD COLUMN IF NOT EXISTS reference_url TEXT;

-- Expand category check to include new types
ALTER TABLE public.research_insights
  DROP CONSTRAINT IF EXISTS research_insights_category_check;

ALTER TABLE public.research_insights
  ADD CONSTRAINT research_insights_category_check
  CHECK (category IN (
    'competencias', 'uso_plataforma', 'correlación', 'varianza',
    'causalidad', 'tendencia', 'comparación',
    'revisión_sistemática', 'desarrollo_producto', 'metodología'
  ));
