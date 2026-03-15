-- ============================================================
-- País de origen y país de residencia del paciente
-- El campo "country" existente (TEXT[]) se usa para visibilidad
-- (qué países pueden ver este paciente).
-- ============================================================

-- País donde nació el paciente
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS country_origin TEXT;

-- País donde reside el paciente
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS country_residence TEXT;

COMMENT ON COLUMN public.ai_patients.country IS 'Países donde este paciente es visible para estudiantes';
COMMENT ON COLUMN public.ai_patients.country_origin IS 'País de origen/nacimiento del paciente';
COMMENT ON COLUMN public.ai_patients.country_residence IS 'País donde reside actualmente el paciente';

-- Para los pacientes existentes, derivar origin/residence del array country
UPDATE public.ai_patients
  SET country_origin = country[1],
      country_residence = country[1]
  WHERE country_origin IS NULL AND array_length(country, 1) > 0;
