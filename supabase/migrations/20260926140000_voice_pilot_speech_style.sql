-- Estilo de habla del piloto de voz: preset elegido desde /admin/voice-pilots
-- para calibrar la naturalidad de la voz (muletillas, ritmo, emotividad) sin
-- tocar código. Las claves válidas viven en src/lib/voice-options.ts y se
-- validan en la API, no acá, para poder sumar presets sin otra migración.

ALTER TABLE public.voice_pilots
  ADD COLUMN IF NOT EXISTS speech_style TEXT NOT NULL DEFAULT 'natural';

COMMENT ON COLUMN public.voice_pilots.speech_style IS
  'Preset de estilo de habla de la voz: ninguno | sobrio | natural | expresivo. Se traduce a un bloque de instrucciones en src/lib/voice-instructions.ts.';
