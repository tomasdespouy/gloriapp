-- ============================================================
-- Detalles personales que humanizan cada paciente IA
-- ============================================================

-- Fecha de nacimiento
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Barrio / sector donde vive (más específico que ciudad)
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Grupo familiar: [{name, age, relationship, notes}]
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS family_members JSONB DEFAULT '[]';
