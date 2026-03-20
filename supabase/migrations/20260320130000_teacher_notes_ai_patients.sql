-- Add teacher notes column for instructor annotations on patients
ALTER TABLE public.ai_patients ADD COLUMN IF NOT EXISTS teacher_notes TEXT DEFAULT NULL;
