-- Contador de faltas antiprofesionales CONFIRMADAS por el juez LLM, por
-- conversación. Se persiste (en vez de recontar el transcripto cada turno) para
-- (a) no re-juzgar el historial con el LLM cada vez, y (b) contar como máximo
-- una falta por turno, evitando que un mensaje fragmentado por el debounce
-- infle el conteo. NULL/0 = sin faltas.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unprofessional_count INTEGER NOT NULL DEFAULT 0;
