-- ============================================================================
-- Fix: Rename Carlos Quispe -> Carlos Paredes (avoid duplicate surname)
-- Fix: Edwin Quispe too silent
-- ============================================================================

-- 1. Rename Carlos Quispe -> Carlos Paredes (nested REPLACE)
UPDATE public.ai_patients
SET
  name = 'Carlos Paredes',
  system_prompt = REPLACE(
    REPLACE(system_prompt, 'Eres Carlos, un hombre', 'Eres Carlos Paredes, un hombre'),
    'Carlos respondería', 'Carlos Paredes respondería'
  ),
  updated_at = NOW()
WHERE name = 'Carlos Quispe';

-- 2. Edwin: soften monosilabicas to allow at least a full sentence
UPDATE public.ai_patients
SET
  system_prompt = REPLACE(
    system_prompt,
    'Respuestas muy cortas, a veces monosilabicas',
    'Respuestas cortas pero completas, al menos una oración con sujeto y verbo'
  ),
  updated_at = NOW()
WHERE name = 'Edwin Quispe';
