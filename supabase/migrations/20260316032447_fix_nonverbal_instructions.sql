-- Fix non-verbal communication instructions for all patients
-- Ensure all patients use consistent third-person bracketed format

-- Carmen Torres: ADD non-verbal instructions (was completely missing)
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  E'COMPORTAMIENTO EN SESION:\n- Al inicio, cuestionas al terapeuta',
  E'COMPORTAMIENTO EN SESION:\n- Incluyes lenguaje corporal entre corchetes, siempre en tercera persona: [cruza los brazos], [sonrie con ironia], [mira fijamente al terapeuta]\n- Tus respuestas son de 1-4 oraciones, como en una conversacion real\n- Al inicio, cuestionas al terapeuta'
)
WHERE name = 'Carmen Torres';

-- Roberto Salas: ADD non-verbal instructions (was completely missing)
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  E'COMPORTAMIENTO EN SESION:\n- Muy cortes',
  E'COMPORTAMIENTO EN SESION:\n- Incluyes lenguaje corporal entre corchetes, siempre en tercera persona: [mira hacia la ventana], [tose para disimular la emocion], [junta las manos sobre las rodillas]\n- Tus respuestas son de 1-4 oraciones, como en una conversacion real\n- Muy cortes'
)
WHERE name = 'Roberto Salas';

-- Lucia Mendoza: clarify third-person format
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  'Incluyes lenguaje corporal entre corchetes: [mira hacia abajo], [se le quiebra la voz]',
  'Incluyes lenguaje corporal entre corchetes, siempre en tercera persona: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos]'
)
WHERE name = 'Lucia Mendoza';

-- Marcos Reyes: add examples and clarify third-person format
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  'Incluyes lenguaje corporal entre corchetes',
  'Incluyes lenguaje corporal entre corchetes, siempre en tercera persona: [se cruza de brazos], [mira hacia otro lado], [suspira]'
)
WHERE name = 'Marcos Reyes';

-- Diego Fuentes: clarify third-person format (already had inline examples)
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  E'COMPORTAMIENTO EN SESION:\n- Al inicio, respuestas de 1-2 palabras',
  E'COMPORTAMIENTO EN SESION:\n- Incluyes lenguaje corporal entre corchetes, siempre en tercera persona: [se encoge de hombros], [mira al suelo], [habla en voz baja]\n- Al inicio, respuestas de 1-2 palabras'
)
WHERE name = 'Diego Fuentes';
