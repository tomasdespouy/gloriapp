-- ============================================================
-- REWRITE non-verbal communication instructions for ALL patients
-- Problem: AI keeps writing first person [me siento, miro, juego con mis manos]
-- Solution: Explicit block with CORRECT/INCORRECT examples + hard REGLAS
-- ============================================================

-- Step 1: Remove ALL existing non-verbal instruction lines from ALL patients
-- These patterns cover both old and new formats
UPDATE ai_patients
SET system_prompt = regexp_replace(
  system_prompt,
  E'- (Incluyes lenguaje corporal|Lenguaje no verbal)[^\n]*\n?',
  '',
  'g'
)
WHERE is_active = true;

-- Step 2: Add the new explicit COMUNICACIÓN NO VERBAL block
-- Insert it right after "COMPORTAMIENTO EN SESION:" line
UPDATE ai_patients
SET system_prompt = regexp_replace(
  system_prompt,
  E'(COMPORTAMIENTO EN SESION:\n)',
  E'\\1- COMUNICACIÓN NO VERBAL: Escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona.\n  CORRECTO: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos], [suspira], [se cruza de brazos]\n  INCORRECTO: [miro hacia abajo], [me quiebro la voz], [juego con mis manos], [suspiro], [me cruzo de brazos]\n  PROHIBIDO usar "me", "mi", "mis", "miro", "siento", "estoy" dentro de los corchetes.\n',
  'g'
)
WHERE is_active = true;

-- Step 3: Add hard rule to REGLAS section
UPDATE ai_patients
SET system_prompt = regexp_replace(
  system_prompt,
  E'(REGLAS:\n)',
  E'\\1- Los corchetes [] son EXCLUSIVAMENTE para lenguaje corporal en TERCERA PERSONA. JAMÁS escribas en primera persona dentro de corchetes. Ejemplo: [sonríe nerviosamente] NO [sonrío nerviosamente].\n',
  'g'
)
WHERE is_active = true;

-- Also handle patients that might have "COMPORTAMIENTO EN SESIÓN:" with accent
UPDATE ai_patients
SET system_prompt = regexp_replace(
  system_prompt,
  E'(COMPORTAMIENTO EN SESIÓN:\n)',
  E'\\1- COMUNICACIÓN NO VERBAL: Escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona.\n  CORRECTO: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos], [suspira], [se cruza de brazos]\n  INCORRECTO: [miro hacia abajo], [me quiebro la voz], [juego con mis manos], [suspiro], [me cruzo de brazos]\n  PROHIBIDO usar "me", "mi", "mis", "miro", "siento", "estoy" dentro de los corchetes.\n',
  'g'
)
WHERE is_active = true
  AND system_prompt NOT LIKE '%NARRADOR EXTERNO%';
