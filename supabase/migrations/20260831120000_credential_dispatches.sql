-- ============================================================================
-- ENTREGA PROGRAMADA DE CREDENCIALES
--
-- Modelo:
--   credential_batches    → lo que el admin ve, nombra, cancela y reprograma.
--   credential_dispatches → UNA fila por PERSONA y por CORREO. Es el registro
--                           contable: sobrevive al cierre de la pestaña y
--                           guarda el MOTIVO exacto de cada omisión.
--
-- Hasta ahora el envío masivo era un bucle en el navegador del admin
-- (UsuariosClient.sendCredentialsToIds): si cerraba la pestaña, el lote se
-- cortaba, y el reporte de quién recibió y quién no vivía solo en el estado de
-- React. Esta tabla es la que convierte eso en algo que sobrevive.
--
-- Las tres modalidades pedidas salen de dos columnas:
--   (a) envío único   → todas las filas con el mismo send_after
--   (b) escalonado    → send_after = starts_at + batch_index * every_minutes
--   (c) recordatorio  → fila hija (kind='recordatorio') que crea el WORKER
--                       cuando la fila original sale, con parent_id.
--
-- NO se toca pilots.scheduled_at: su semántica es "inicio de la ventana de
-- acceso" y la consumen src/lib/access-status.ts y src/app/(app)/layout.tsx.
-- "Cuándo mandar el correo" vive solo en credential_batches.starts_at.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles.password_set_at
--    Instante en que la persona fijó una contraseña ELEGIDA POR ELLA.
--    Es la señal robusta que must_change_password no puede ser: esa columna
--    nace en false por DEFAULT y la autoinscripción de pilotos nunca la prende,
--    así que "must_change_password = false" no distingue "ya eligió su clave"
--    de "nunca se le pidió".
--    NO hay backfill posible: para las cuentas anteriores a esta migración
--    queda NULL y la protección la da last_sign_in_at.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.password_set_at IS
  'Instante en que la persona fijó su propia contraseña (lo escribe el servidor en /api/profile/clear-password-flag). NULL = nunca, o cuenta anterior al 2026-08-31 (sin backfill posible).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. email_log: hoy es (id, type, recipient, success, sent_at) y no permite
--    responder "¿a esta persona se le mandó este correo?" sin cruzar por texto,
--    ni rastrear un envío concreto en el panel de Resend.
--    SIN claves foráneas a propósito: el log debe sobrevivir al borrado de la
--    cuenta y del lote.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS user_id             UUID,
  ADD COLUMN IF NOT EXISTS dispatch_id         UUID,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS error_code          TEXT;

CREATE INDEX IF NOT EXISTS email_log_user_idx
  ON public.email_log (user_id, sent_at DESC);

-- Segunda barrera de idempotencia, independiente del estado del despacho.
CREATE UNIQUE INDEX IF NOT EXISTS email_log_dispatch_uidx
  ON public.email_log (dispatch_id) WHERE dispatch_id IS NOT NULL AND success;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. credential_batches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credential_batches (
  -- El id lo genera el CLIENTE (crypto.randomUUID()). Reintentar el POST con
  -- el mismo id choca contra la PK y la ruta devuelve el lote existente en vez
  -- de duplicar el envío.
  id                    UUID PRIMARY KEY,

  label                 TEXT CHECK (label IS NULL OR char_length(label) BETWEEN 3 AND 120),

  -- Autoría. El worker revalida el alcance de esta persona EN EL DESPACHO.
  scheduled_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_by_role     TEXT NOT NULL CHECK (scheduled_by_role IN ('admin','superadmin')),

  -- Reglas de admin_establishments al momento de agendar. AUDITA, NO AUTORIZA:
  -- el permiso se revalida contra la tabla viva en cada despacho.
  scope_snapshot        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Descripción legible de la audiencia, para el panel y para reprogramar.
  audience_summary      JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- A QUIÉN alcanza:
  --   nunca_ingreso → solo a quien NUNCA inició sesión. Para esa gente no
  --                   existe una contraseña que perder: rotarla es inocuo.
  --   reemision     → también a quien ya ingresó. Acto destructivo consciente.
  --                   NO desactiva la guarda de "clave propia".
  audience_rule         TEXT NOT NULL DEFAULT 'nunca_ingreso'
                          CHECK (audience_rule IN ('nunca_ingreso','reemision')),

  source                TEXT NOT NULL DEFAULT 'usuarios'
                          CHECK (source IN ('usuarios','programa')),
  pilot_id              UUID REFERENCES public.pilots(id) ON DELETE SET NULL,

  -- Texto libre que se inserta en el correo.
  custom_intro          TEXT CHECK (custom_intro IS NULL OR char_length(custom_intro) <= 2000),

  -- Cuándo arranca (UTC). La UI captura y muestra en hora de Chile.
  starts_at             TIMESTAMPTZ NOT NULL,

  -- Ritmo. 0/0 = todo de una vez. Si no, tandas de per_batch cada every_minutes.
  per_batch             INTEGER NOT NULL DEFAULT 0 CHECK (per_batch BETWEEN 0 AND 500),
  every_minutes         INTEGER NOT NULL DEFAULT 0 CHECK (every_minutes BETWEEN 0 AND 10080),

  reminder_after_days   SMALLINT CHECK (reminder_after_days IS NULL OR reminder_after_days BETWEEN 1 AND 30),

  -- Cancelación. El worker relee esto ANTES de tocar cada contraseña, así que
  -- cancelar detiene también lo que ya estaba reclamado en 'procesando'.
  cancel_requested_at   TIMESTAMPTZ,
  cancel_requested_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  closed_at             TIMESTAMPTZ,          -- no quedan filas no terminales
  closed_notified_at    TIMESTAMPTZ,          -- correo de resumen ya enviado

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT credential_batches_ritmo_chk CHECK (
    (per_batch = 0 AND every_minutes = 0) OR (per_batch > 0 AND every_minutes > 0)
  ),
  CONSTRAINT credential_batches_programa_chk CHECK (
    source <> 'programa' OR pilot_id IS NOT NULL
  )
);

DROP TRIGGER IF EXISTS set_credential_batches_updated_at ON public.credential_batches;
CREATE TRIGGER set_credential_batches_updated_at
  BEFORE UPDATE ON public.credential_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS credential_batches_open_idx
  ON public.credential_batches (starts_at DESC) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS credential_batches_scheduler_idx
  ON public.credential_batches (scheduled_by, created_at DESC);
CREATE INDEX IF NOT EXISTS credential_batches_pilot_idx
  ON public.credential_batches (pilot_id) WHERE pilot_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. credential_dispatches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credential_dispatches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL REFERENCES public.credential_batches(id) ON DELETE CASCADE,

  kind                  TEXT NOT NULL DEFAULT 'credenciales'
                          CHECK (kind IN ('credenciales','recordatorio')),
  -- Fila original de la que nació el recordatorio. Da la fecha de referencia
  -- ("¿ingresó DESPUÉS de recibir sus credenciales?").
  parent_id             UUID REFERENCES public.credential_dispatches(id) ON DELETE SET NULL,

  -- SET NULL, no CASCADE: borrar a una persona no borra la historia del envío.
  user_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_snapshot        TEXT NOT NULL,   -- solo para el reporte; se envía al correo VIGENTE
  name_snapshot         TEXT,

  -- Nº de tanda (0-based). Reprogramar recalcula send_after preservando este
  -- índice, así el escalonado no se aplana.
  batch_index           INTEGER NOT NULL DEFAULT 0,

  -- INTENCIÓN del admin: es lo que se muestra en pantalla.
  send_after            TIMESTAMPTZ NOT NULL,
  -- PLANIFICACIÓN real: la mueven el backoff y el 429. El worker consulta por acá.
  next_attempt_at       TIMESTAMPTZ NOT NULL,
  -- Fecha de muerte ABSOLUTA, fijada al agendar y NUNCA movida por reintentos.
  -- Impide que un 429 persistente empuje la fila hacia adelante para siempre.
  expires_at            TIMESTAMPTZ NOT NULL,

  status                TEXT NOT NULL DEFAULT 'pendiente'
                          CHECK (status IN ('pendiente','procesando','enviado',
                                            'omitido','fallido','cancelado')),

  -- Enum cerrado: todo motivo que el worker puede escribir está acá.
  skip_reason           TEXT CHECK (skip_reason IS NULL OR skip_reason IN (
                          'ya_ingreso','clave_propia','cuenta_desactivada',
                          'usuario_eliminado','sin_correo','fuera_de_alcance',
                          'admin_sin_permiso','rol_no_elegible','programa_cerrado',
                          'ya_recibio_credenciales','vencido','cancelado_por_admin')),

  attempts              SMALLINT NOT NULL DEFAULT 0,
  max_attempts          SMALLINT NOT NULL DEFAULT 4,
  -- Diferimientos por 429 / cuota. NO consumen `attempts` (un 429 no es culpa
  -- del destinatario) pero expires_at los acota igual.
  deferrals             SMALLINT NOT NULL DEFAULT 0,

  claimed_at            TIMESTAMPTZ,   -- entrada a 'procesando' (rescate de zombis)
  sent_at               TIMESTAMPTZ,
  last_error            TEXT,
  provider_message_id   TEXT,

  -- Clave temporal generada ANTES de rotarla, reutilizada en cada reintento.
  -- Es lo que convierte un reintento en "el mismo correo otra vez" en vez de
  -- "una segunda clave que invalida la primera". Se borra al llegar a estado
  -- terminal. Vive en una tabla sin política de lectura (solo service-role).
  pending_password      TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Motivo y estado no pueden contradecirse.
  CONSTRAINT credential_dispatches_motivo_chk CHECK (
    (status IN ('omitido','cancelado') AND skip_reason IS NOT NULL) OR
    (status NOT IN ('omitido','cancelado') AND skip_reason IS NULL)
  ),
  CONSTRAINT credential_dispatches_enviado_chk CHECK (
    status <> 'enviado' OR sent_at IS NOT NULL
  ),
  -- Un recordatorio siempre cuelga de un original.
  CONSTRAINT credential_dispatches_recordatorio_chk CHECK (
    kind <> 'recordatorio' OR parent_id IS NOT NULL
  )
);

DROP TRIGGER IF EXISTS set_credential_dispatches_updated_at ON public.credential_dispatches;
CREATE TRIGGER set_credential_dispatches_updated_at
  BEFORE UPDATE ON public.credential_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cola caliente del worker.
CREATE INDEX IF NOT EXISTS credential_dispatches_due_idx
  ON public.credential_dispatches (next_attempt_at) WHERE status = 'pendiente';

-- Rescate de filas colgadas.
CREATE INDEX IF NOT EXISTS credential_dispatches_claimed_idx
  ON public.credential_dispatches (claimed_at) WHERE status = 'procesando';

-- Panel y detalle por lote.
CREATE INDEX IF NOT EXISTS credential_dispatches_batch_idx
  ON public.credential_dispatches (batch_id, status);

-- Insignia "envío programado" en la fila de /admin/usuarios.
CREATE INDEX IF NOT EXISTS credential_dispatches_user_open_idx
  ON public.credential_dispatches (user_id) WHERE status IN ('pendiente','procesando');

-- IDEMPOTENCIA DEL ALTA. Índice NO parcial a propósito: PostgREST solo puede
-- emitir ON CONFLICT sobre un índice único total, así que
-- .upsert(rows, { onConflict: 'batch_id,user_id,kind', ignoreDuplicates: true })
-- funciona y un reintento del POST no duplica filas.
-- NO existe un índice "una sola cola abierta por persona" a nivel global: eso
-- convertiría un alta de 124 en todo-o-nada por una sola colisión. El
-- solapamiento entre lotes lo resuelve la regla ya_recibio_credenciales.
CREATE UNIQUE INDEX IF NOT EXISTS credential_dispatches_batch_user_kind_uidx
  ON public.credential_dispatches (batch_id, user_id, kind);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista de resumen por lote (estado DERIVADO, nunca almacenado).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.credential_batch_stats WITH (security_invoker = true) AS
SELECT b.id                                                           AS batch_id,
       count(d.id)                                                    AS total,
       count(*) FILTER (WHERE d.status = 'pendiente')                 AS pendientes,
       count(*) FILTER (WHERE d.status = 'procesando')                AS procesando,
       count(*) FILTER (WHERE d.status = 'enviado')                   AS enviados,
       count(*) FILTER (WHERE d.status = 'omitido')                   AS omitidos,
       count(*) FILTER (WHERE d.status = 'fallido')                   AS fallidos,
       count(*) FILTER (WHERE d.status = 'cancelado')                 AS cancelados,
       min(d.send_after) FILTER (WHERE d.status = 'pendiente')        AS proximo_envio,
       max(d.send_after)                                              AS ultimo_envio
  FROM public.credential_batches b
  LEFT JOIN public.credential_dispatches d ON d.batch_id = b.id
 GROUP BY b.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reclamo atómico. PostgREST no puede FOR UPDATE SKIP LOCKED ni expresar
--    `attempts + 1`. Sin esto, dos corridas simultáneas (el cron nativo y un
--    "Ejecutar ahora", o un reintento por timeout) envían dos veces.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_credential_dispatches(p_limit INTEGER)
RETURNS SETOF public.credential_dispatches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.credential_dispatches d
     SET status     = 'procesando',
         claimed_at = now(),
         attempts   = d.attempts + 1,
         updated_at = now()
   WHERE d.id IN (
     SELECT c.id
       FROM public.credential_dispatches c
       JOIN public.credential_batches b ON b.id = c.batch_id
      WHERE c.status = 'pendiente'
        AND c.next_attempt_at <= now()
        AND c.expires_at      >  now()
        AND c.attempts        <  c.max_attempts
        AND b.cancel_requested_at IS NULL
      ORDER BY c.next_attempt_at
      LIMIT p_limit
      FOR UPDATE OF c SKIP LOCKED
   )
  RETURNING d.*;
END $$;

-- El repo no tiene precedente de GRANT/REVOKE: service_role hereda EXECUTE de
-- PUBLIC. Si se revoca sin otorgar, el worker muere con "permission denied for
-- function" en su primera corrida real.
REVOKE ALL ON FUNCTION public.claim_credential_dispatches(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_credential_dispatches(INTEGER) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Lectura EN LOTE de auth.users.last_sign_in_at.
--    Es el único campo que literalmente significa "inició sesión": lo escribe
--    GoTrue, no depende de nuestro heartbeat, es inmune a la exención de
--    pilotos del gate de cambio de clave, y updateUserById({password}) no lo
--    resetea. Hoy solo se puede leer de a uno (api/admin/pilots/[id]/route.ts
--    hace un bucle de getUserById). Esta función lo hace en un viaje.
--    Superficie mínima: una columna, solo lectura, solo service_role.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_last_sign_in(p_ids UUID[])
RETURNS TABLE (user_id UUID, last_sign_in_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.last_sign_in_at
    FROM auth.users u
   WHERE u.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.auth_last_sign_in(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_last_sign_in(UUID[]) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Latido del despachador. Sin esto, un cron muerto es indistinguible de una
--    cola vacía y nadie se entera hasta que un docente reclama.
--    Lo leen /api/health y la barrida diaria de cleanup-sessions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispatch_runtime (
  id                BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  last_run_at       TIMESTAMPTZ,
  last_run_claimed  INTEGER NOT NULL DEFAULT 0,
  last_run_sent     INTEGER NOT NULL DEFAULT 0,
  last_run_failed   INTEGER NOT NULL DEFAULT 0,
  -- Freno global tras un 429 o una cuota agotada de Resend.
  throttled_until   TIMESTAMPTZ,
  throttle_reason   TEXT,
  alerted_at        TIMESTAMPTZ,   -- última alerta enviada (anti-spam)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.dispatch_runtime (id) VALUES (true) ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS
--    Misma postura que research_jobs y email_log: superadmin lee directo; TODO
--    el acceso de un admin normal pasa por rutas server con service-role que
--    reaplican resolveAdminScopeRules/matchesScope. NO se escribe el alcance en
--    SQL: vive en admin_establishments y duplicarlo sería una segunda fuente de
--    verdad (el repo ya pagó dos correcciones de alcance).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.credential_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_runtime      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin gestiona lotes de credenciales" ON public.credential_batches;
CREATE POLICY "Superadmin gestiona lotes de credenciales"
  ON public.credential_batches FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin gestiona entregas de credenciales" ON public.credential_dispatches;
CREATE POLICY "Superadmin gestiona entregas de credenciales"
  ON public.credential_dispatches FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- dispatch_runtime: sin políticas (solo service-role).
