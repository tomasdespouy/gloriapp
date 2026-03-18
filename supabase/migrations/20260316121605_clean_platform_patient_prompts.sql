-- ============================================================
-- Clean platform-created patients: remove example dialogue lines
-- that mix first-person text with brackets, confusing the AI
-- ============================================================

-- Remove lines like: "- Hablo de manera pausada... [mira al suelo]"
-- These are behavior descriptions with embedded examples that confuse the AI
-- We keep the COMUNICACIÓN NO VERBAL block and REGLAS which are clean

-- Valentina Ospina: remove first-person behavior descriptions with brackets
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- Hablo de manera pausada[^\n]*\n- Suelo sonreír[^\n]*\n- Me pongo nerviosa[^\n]*\n- Hago pausas largas[^\n]*\n',
  '',
  'g'
) WHERE name = 'Valentina Ospina';

-- Yamilet Pérez: remove first-person behavior descriptions with brackets
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- Me pongo nerviosa cuando hablo[^\n]*\n- A veces me río[^\n]*\n- Suspiro profundamente[^\n]*\n',
  '',
  'g'
) WHERE name = 'Yamilet Pérez';

-- For ALL platform patients: remove example dialogue lines that contain
-- both brackets and first-person pronouns (quotes like "me siento", "me pongo")
-- These are the "- [Suspira] 'A veces siento que...'" pattern lines
-- We use a broad cleanup: remove lines starting with '- "' or '- [' that contain 'me '
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\n]*"[^\n]*me [^\n]*\n',
  '',
  'gi'
) WHERE name IN ('Rosa Huamán', 'Jorge Ramírez', 'Carlos Quispe', 'Rafael Santos', 'Andrés Castillo', 'Sofía Pellegrini');

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- "[^\n]*me [^\n]*\\[[^\n]*\n',
  '',
  'gi'
) WHERE name IN ('Rosa Huamán', 'Jorge Ramírez', 'Carlos Quispe', 'Rafael Santos', 'Andrés Castillo', 'Sofía Pellegrini', 'Valentina Ospina');

-- Also clean up any remaining example dialogue lines with first person inside quotes after brackets
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "No sé (por )?qué[^\n]*\n',
  '',
  'gi'
) WHERE is_active = true;

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "Pues, no sé[^\n]*\n',
  '',
  'gi'
) WHERE is_active = true;

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "A veces[^\n]*me [^\n]*\n',
  '',
  'gi'
) WHERE is_active = true;

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "A mis hijos[^\n]*\n',
  '',
  'gi'
) WHERE is_active = true;

-- Clean Valentina's remaining example dialogue lines
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- "La verdad, a veces[^\n]*\n',
  '',
  'g'
) WHERE name = 'Valentina Ospina';

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- "Esto es raro[^\n]*\n',
  '',
  'g'
) WHERE name = 'Valentina Ospina';

-- Rosa cleanup
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "Bueno, ya[^\n]*\n',
  '',
  'gi'
) WHERE name = 'Rosa Huamán';

-- Sofia cleanup
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "No estoy segura[^\n]*\n',
  '',
  'gi'
) WHERE name = 'Sofía Pellegrini';

UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- "Es como que[^\n]*\\[[^\n]*\n',
  '',
  'gi'
) WHERE name = 'Sofía Pellegrini';

-- Jorge cleanup
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "Es que la gente[^\n]*\n',
  '',
  'gi'
) WHERE name = 'Jorge Ramírez';

-- Andres cleanup
UPDATE ai_patients SET system_prompt = regexp_replace(
  system_prompt,
  E'- \\[[^\]]+\\] "A veces siento[^\n]*\n',
  '',
  'gi'
) WHERE name = 'Andrés Castillo';
