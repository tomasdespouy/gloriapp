-- ============================================================
-- Log de correos enviados (para el contador diario en el panel superadmin).
-- Cada vez que la plataforma manda un correo vía Resend, se registra una fila.
-- Lo escribe el cliente service-role (admin) y lo lee el panel admin
-- (server component, también service-role), así que RLS queda cerrado para el
-- resto (sin políticas = nadie más lo lee/escribe).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,                -- credentials | feedback | pending_review | ...
  recipient  TEXT,
  success    BOOLEAN NOT NULL DEFAULT true,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_sent_at_idx ON public.email_log (sent_at);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service-role (que ignora RLS) puede leer/escribir.
