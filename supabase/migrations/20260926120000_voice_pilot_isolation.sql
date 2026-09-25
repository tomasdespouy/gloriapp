-- ============================================================
-- Piloto de voz (Fernanda Contreras · Solo voz) — Etapa 0+1: contratos +
-- aislamiento. Ver docs/specs/paciente-voz-latam/.
--
-- Esta migración NO activa nada ni llama a ninguna API paga: crea el modelo
-- de datos, permisos y la variante de paciente en estado apagado
-- (voice_pilots.enabled = false, ai_patients.is_active = false). Cubre
-- AC-01 a AC-08, AC-18 y AC-20 de docs/specs/paciente-voz-latam/03-...md.
--
-- Diferido a la Etapa 2 (relé de voz, conexión real): voice_connections,
-- voice_events, voice_transcript_segments, voice_recording_chunks,
-- voice_memory_snapshots, voice_cost_ledger. Nada de esto se necesita para
-- aislamiento/permisos sin conexión real.
-- ============================================================

-- ── 1. Extensión de ai_patients (defaults = comportamiento actual) ────────
ALTER TABLE public.ai_patients
  ADD COLUMN IF NOT EXISTS base_patient_id UUID REFERENCES public.ai_patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interaction_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (interaction_mode IN ('text', 'voice_only')),
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private_pilot'));

CREATE INDEX IF NOT EXISTS idx_ai_patients_base_patient ON public.ai_patients(base_patient_id);

COMMENT ON COLUMN public.ai_patients.base_patient_id IS
  'Para variantes (ej. piloto de voz): apunta al paciente original del que se clonó. NULL = paciente base.';
COMMENT ON COLUMN public.ai_patients.interaction_mode IS
  '''text'' (default, comportamiento actual): chat/TTS ordinario. ''voice_only'': variante exclusiva del piloto de voz Realtime, sin caja de texto — las rutas de chat ordinarias la rechazan.';
COMMENT ON COLUMN public.ai_patients.visibility IS
  '''public'' (default): visibilidad normal por país/asignación. ''private_pilot'': solo visible a quien tenga voice_pilot_access vigente, sin importar país/establecimiento (AU-02, AU-06).';

-- ── 2. Tablas del piloto de voz (RLS superadmin-only, mismo patrón que
--      course_patients/establishment_patients) ────────────────────────────

CREATE TABLE public.voice_pilots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_patient_id       UUID NOT NULL UNIQUE REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT false,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  model               TEXT NOT NULL DEFAULT 'gpt-realtime-mini',
  model_snapshot      TEXT,
  voice_id            TEXT,
  max_duration_seconds INTEGER NOT NULL DEFAULT 3600,
  budget_usd          NUMERIC(10,4) NOT NULL DEFAULT 1.00,
  retention_days      INTEGER NOT NULL DEFAULT 30,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.voice_pilots IS
  'Configuración del piloto de voz por variante de paciente (AR/AU/T de la SPEC). enabled=false por default: apagado hasta que un superadmin lo prenda explícitamente. ends_at NULL = nunca puede iniciarse (fail-closed, ver voice-pilot-auth.ts) hasta que se fije una fecha real.';

CREATE TABLE public.voice_pilot_access (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id          UUID NOT NULL REFERENCES public.voice_pilots(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_participate   BOOLEAN NOT NULL DEFAULT true,
  can_review_own    BOOLEAN NOT NULL DEFAULT true,
  expires_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  granted_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pilot_id, user_id)
);

COMMENT ON TABLE public.voice_pilot_access IS
  'Quién puede ver/participar en un piloto de voz (AU-02/AU-03). Incorporar a alguien conserva su rol/país institucional — no lo convierte en superadmin ni habilita su institución (P-04).';

CREATE TABLE public.voice_attempt_grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id        UUID NOT NULL REFERENCES public.voice_pilots(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL,
  granted_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pilot_id, user_id, attempt_number)
);

COMMENT ON TABLE public.voice_attempt_grants IS
  'Cupos concedidos (R-01): 1 fila = 1 intento disponible. attempt_number correlativo por usuario/piloto. consumed_by se agrega más abajo (evita referencia circular con voice_attempts).';

CREATE TABLE public.voice_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id          UUID NOT NULL UNIQUE REFERENCES public.voice_attempt_grants(id) ON DELETE RESTRICT,
  conversation_id   UUID UNIQUE REFERENCES public.conversations(id) ON DELETE SET NULL,
  attempt_number    INTEGER NOT NULL,
  clinical_session_number INTEGER NOT NULL DEFAULT 1,
  -- Ciclo de vida reducido para Etapa 1 (sin conexión real todavía). La
  -- máquina de estados completa de 02-arquitectura.md §4 llega en Etapa 2.
  lifecycle         TEXT NOT NULL DEFAULT 'authorized'
    CHECK (lifecycle IN ('authorized', 'active', 'closed', 'technical_end')),
  started_at        TIMESTAMPTZ,
  deadline_at       TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  end_reason        TEXT,
  model_snapshot    TEXT,
  voice_snapshot    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.voice_attempts IS
  'Un intento real del piloto de voz. ST-01 a ST-06 completos (conexión/reconexión/finalización) se implementan en Etapa 2 — acá solo el registro autorizado, suficiente para probar consumo atómico de cupo (AU-07, AC-07, AC-18).';

ALTER TABLE public.voice_attempt_grants
  ADD COLUMN consumed_by UUID UNIQUE REFERENCES public.voice_attempts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.voice_attempt_grants.consumed_by IS
  'Se fija atómicamente (UPDATE ... WHERE consumed_by IS NULL) al iniciar un intento. NULL = cupo disponible.';

CREATE TABLE public.voice_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  reason      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.voice_audit_log IS
  'Bitácora de acciones administrativas del piloto de voz (grant/revoke/reset/enable/disable). Sin contenido clínico (AU-... / G-07).';

CREATE INDEX idx_voice_pilot_access_pilot ON public.voice_pilot_access(pilot_id);
CREATE INDEX idx_voice_pilot_access_user ON public.voice_pilot_access(user_id);
CREATE INDEX idx_voice_attempt_grants_pilot_user ON public.voice_attempt_grants(pilot_id, user_id);
CREATE INDEX idx_voice_attempts_grant ON public.voice_attempts(grant_id);
CREATE INDEX idx_voice_audit_log_resource ON public.voice_audit_log(resource, created_at);

CREATE TRIGGER set_voice_pilots_updated_at
  BEFORE UPDATE ON public.voice_pilots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_voice_attempts_updated_at
  BEFORE UPDATE ON public.voice_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. conversations: modalidad + enlace al intento ────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'text'
    CHECK (modality IN ('text', 'voice')),
  ADD COLUMN IF NOT EXISTS voice_attempt_id UUID REFERENCES public.voice_attempts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.conversations.modality IS
  '''text'' (default, comportamiento actual). ''voice'': sesión del piloto de voz — se excluye de progreso institucional, rankings, XP, correos y reportes generales (A-05, AC-20).';

-- ── 4. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.voice_pilots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_pilot_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_attempt_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on voice_pilots"
  ON public.voice_pilots FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin full access on voice_pilot_access"
  ON public.voice_pilot_access FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Participant reads own voice_pilot_access"
  ON public.voice_pilot_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmin full access on voice_attempt_grants"
  ON public.voice_attempt_grants FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Participant reads own voice_attempt_grants"
  ON public.voice_attempt_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmin full access on voice_attempts"
  ON public.voice_attempts FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- El propietario solo lee/actualiza su propio intento (nunca crea uno
-- directo por RLS: el consumo de cupo es atómico vía service-role en el
-- endpoint /api/voice-pilot/attempts, no vía INSERT directo del cliente).
CREATE POLICY "Owner reads own voice_attempts"
  ON public.voice_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_attempt_grants g
      WHERE g.id = voice_attempts.grant_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmin full access on voice_audit_log"
  ON public.voice_audit_log FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ── 5. Clonar Fernanda Contreras → variante de voz (P-01/C-02) ─────────────
-- Usa %ROWTYPE para copiar TODA la fila vigente (incluye los bloques de
-- enriquecimiento JSONB) sin enumerar columnas a mano — así siempre clona la
-- ficha vigente al momento en que esta migración corre, nunca el seed
-- histórico. Idempotente: si el clon ya existe, no hace nada.
DO $$
DECLARE
  src public.ai_patients%ROWTYPE;
  new_row public.ai_patients%ROWTYPE;
  new_pilot_id UUID;
BEGIN
  SELECT * INTO src FROM public.ai_patients
    WHERE name = 'Fernanda Contreras' AND base_patient_id IS NULL
    ORDER BY created_at ASC LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE 'Fernanda Contreras (paciente base) no encontrada — se omite la clonación. Ejecutar a mano cuando exista.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_patients
    WHERE base_patient_id = src.id AND interaction_mode = 'voice_only'
  ) THEN
    RAISE NOTICE 'La variante de voz de Fernanda ya existe — se omite.';
    RETURN;
  END IF;

  new_row := src;
  new_row.id := gen_random_uuid();
  new_row.name := 'Fernanda Contreras · Solo voz';
  new_row.base_patient_id := src.id;
  new_row.interaction_mode := 'voice_only';
  new_row.visibility := 'private_pilot';
  new_row.country := ARRAY['Latinoamérica'];
  new_row.total_sessions := 1;
  new_row.difficulty_level := 'beginner';
  -- Apagado por defecto además del flag del piloto (A-01, defensa en
  -- profundidad): invisible incluso si el filtro de catálogo nuevo tuviera
  -- un error, gracias al gate de is_active ya existente y probado.
  new_row.is_active := false;
  new_row.created_at := NOW();
  new_row.updated_at := NOW();

  INSERT INTO public.ai_patients SELECT (new_row).*;

  INSERT INTO public.voice_pilots (ai_patient_id, enabled)
  VALUES (new_row.id, false)
  RETURNING id INTO new_pilot_id;

  RAISE NOTICE 'Variante de voz creada: ai_patients.id=%, voice_pilots.id=% (ambos apagados/inactivos)', new_row.id, new_pilot_id;
END $$;
