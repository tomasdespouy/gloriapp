ALTER TABLE public.ai_patients ADD COLUMN IF NOT EXISTS voice_id TEXT;

-- Assign voices to existing patients
-- Vicente (Chilean male) for Roberto Salas
UPDATE ai_patients SET voice_id = '6WgXEzo1HGn3i7ilT4Fh' WHERE name = 'Roberto Salas';

-- Camila (Chilean female) for Fernanda Contreras
UPDATE ai_patients SET voice_id = 'oJIuRMopN0sojGjwD6rQ' WHERE name = 'Fernanda Contreras';
