-- Ensure ALL patients have "siempre en tercera persona" in their non-verbal instruction.
-- This catches the 12 patients that were missed in the previous migration,
-- plus fixes Marcos Herrera (wrong name used before).

-- For patients that have "corchetes" but NOT "tercera persona",
-- replace "corchetes" with "corchetes, siempre en tercera persona"
UPDATE ai_patients
SET system_prompt = REPLACE(
  system_prompt,
  'corchetes',
  'corchetes, siempre en tercera persona'
)
WHERE system_prompt LIKE '%corchetes%'
  AND system_prompt NOT LIKE '%tercera persona%';
