-- Informe semanal automático por institución.
--
-- Tres tablas y no una porque son tres preguntas distintas: a quién le llega,
-- qué pasó en cada corrida, y qué pasó con cada correo de esa corrida.
--
-- No se reutiliza email_log para el detalle por destinatario: tiene un índice
-- ÚNICO sobre dispatch_id cuando success, pensado para el envío de credenciales
-- donde un despacho es un correo. Acá un despacho son cinco correos, y el
-- segundo chocaría contra ese índice.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quién recibe el informe de cada institución
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  full_name         TEXT,
  -- Desactivar en vez de borrar: si alguien deja de recibir el informe, queda
  -- el registro de que alguna vez lo recibió.
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive: nadie debería quedar suscrito dos veces por escribir su
-- correo con mayúscula distinta.
CREATE UNIQUE INDEX IF NOT EXISTS report_subscriptions_uidx
  ON public.report_subscriptions (establishment_id, lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Una corrida semanal por institución
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  -- Semana ISO, p. ej. "2026-W37". Es la clave de idempotencia real: el cron
  -- corre dos veces cada lunes (por el cambio de hora de Chile) y solo una
  -- puede enviar.
  period_key        TEXT NOT NULL,
  -- pending | sent | failed | skipped
  status            TEXT NOT NULL DEFAULT 'pending',
  recipients        INTEGER NOT NULL DEFAULT 0,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  -- Por qué se saltó, o qué falló. Se muestra tal cual en el panel.
  note              TEXT,
  -- Foto de las cifras que se enviaron, para poder responder "¿qué decía el
  -- informe del lunes pasado?" sin regenerarlo con datos que ya cambiaron.
  snapshot          JSONB,
  triggered_by      TEXT NOT NULL DEFAULT 'cron',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS report_runs_period_uidx
  ON public.report_runs (establishment_id, period_key);

CREATE INDEX IF NOT EXISTS report_runs_recientes_idx
  ON public.report_runs (started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Un correo por destinatario dentro de una corrida
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_deliveries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               UUID NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  email                TEXT NOT NULL,
  success              BOOLEAN NOT NULL DEFAULT FALSE,
  provider_message_id  TEXT,
  error                TEXT,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lo que informa Resend por webhook: delivered, bounced, complained, opened.
  -- NULL = todavía no llegó ningún evento. "Enviado" y "entregado" no son lo
  -- mismo y el panel los muestra por separado a propósito.
  delivery_status      TEXT,
  delivery_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS report_deliveries_run_idx
  ON public.report_deliveries (run_id);

-- El webhook llega con el id de Resend y nada más; por acá lo encuentra.
CREATE INDEX IF NOT EXISTS report_deliveries_msg_idx
  ON public.report_deliveries (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: las tres tablas se leen y escriben solo desde el servidor con la clave
-- de servicio. Se habilita RLS sin políticas para que nadie las alcance con la
-- clave anónima.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_deliveries    ENABLE ROW LEVEL SECURITY;
