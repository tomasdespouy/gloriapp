-- Add country to ai_patients
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Chile';
