-- Add distinctive_factor column to ai_patients
-- Free-text field for identity-defining traits that take priority in consultation
-- Examples: feminist, convict, disabled, specific traumatic event, gender identity, forced migrant
ALTER TABLE ai_patients ADD COLUMN IF NOT EXISTS distinctive_factor TEXT DEFAULT NULL;
