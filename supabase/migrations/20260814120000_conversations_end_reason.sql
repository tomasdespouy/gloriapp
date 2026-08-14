-- Motivo por el que una sesión se cerró SOLA, es decir, cuando el paciente se
-- retiró y la plataforma marcó la conversación como completed sin que el
-- estudiante la terminara. Hasta ahora el motivo solo quedaba en los logs, así
-- que el docente veía "Completada" sin poder distinguir un cierre normal de un
-- retiro del paciente, y los falsos positivos del detector eran invisibles.
--
-- Valores esperados (prefijo estable + detalle):
--   'directed_threat: te voy a matar'   → amenaza dirigida (confirmada por el juez LLM)
--   'disrespect: idiota'                → insulto dirigido (confirmado por el juez LLM)
--   'name_evasion'                      → el terapeuta nunca dio su nombre
--   'unprofessional: role_reversal (x3)' → conducta antiprofesional reiterada
-- NULL = la sesión no fue cerrada por el paciente.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS end_reason TEXT;

COMMENT ON COLUMN public.conversations.end_reason IS
  'Motivo del cierre automático cuando el paciente se retira. NULL si la sesión terminó normalmente.';
