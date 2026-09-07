-- Recordatorio al estudiante cuando deja una sesión sin cerrar.
--
-- Marca de "ya le escribimos por esta conversación". Sin ella, el cron le
-- mandaría el mismo correo cada vez que corre, que es cada 15 minutos.
--
-- Nullable a propósito: NULL significa "todavía no se le avisó", que es el
-- estado correcto para todas las conversaciones que ya existen.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS student_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.conversations.student_reminder_sent_at IS
  'Cuándo se le avisó al estudiante que esta sesión quedó sin cerrar. NULL = sin avisar.';

-- El cron busca abandonadas y sin avisar, ordenadas por cuándo terminaron.
-- Índice parcial: las ya avisadas quedan fuera y con el tiempo son la mayoría.
CREATE INDEX IF NOT EXISTS conversations_pending_student_reminder_idx
  ON public.conversations (ended_at)
  WHERE status = 'abandoned' AND student_reminder_sent_at IS NULL;
