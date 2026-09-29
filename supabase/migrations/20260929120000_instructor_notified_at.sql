-- Desacopla "sesión marcada abandonada" (inmediato, siempre) de "correo al
-- docente enviado" (diferido a horario hábil). Antes ambas cosas pasaban en
-- el mismo paso de cleanup-sessions: si el aviso se saltaba por ser de
-- madrugada, la conversación ya no volvía a aparecer en la consulta
-- (status='active') de la siguiente corrida y el aviso se perdía sin dejar
-- rastro. Con esta columna, el correo se busca por separado y sobrevive
-- corridas saltadas.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS instructor_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.conversations.instructor_notified_at IS
  'Cuándo se envió al docente el correo de "sesión sin cerrar, pendiente de revisión" tras un abandono. NULL = pendiente. Independiente de status=abandoned a propósito: permite diferir el correo a horario hábil sin perder el aviso.';
