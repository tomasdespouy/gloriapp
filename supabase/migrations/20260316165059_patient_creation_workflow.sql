-- New fields for the 15-step patient creation workflow
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS short_narrative JSONB,
  ADD COLUMN IF NOT EXISTS extended_narrative JSONB,
  ADD COLUMN IF NOT EXISTS coherence_review JSONB,
  ADD COLUMN IF NOT EXISTS projections JSONB,
  ADD COLUMN IF NOT EXISTS creation_step INTEGER DEFAULT 0;
