-- Pilots module: manage university pilot deployments
CREATE TABLE public.pilots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  institution     TEXT NOT NULL,
  country         TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  status          TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'validado', 'enviado', 'en_curso', 'finalizado', 'cancelado')),
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  establishment_id UUID REFERENCES public.establishments(id),
  csv_data        JSONB DEFAULT '[]',
  email_template  TEXT,
  email_sent_at   TIMESTAMPTZ,
  report_url      TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pilot participants (validated from CSV)
CREATE TABLE public.pilot_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id        UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
  user_id         UUID REFERENCES auth.users(id),
  status          TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'invitado', 'activo', 'inactivo')),
  invite_sent_at  TIMESTAMPTZ,
  first_login_at  TIMESTAMPTZ,
  sessions_count  INTEGER DEFAULT 0,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on pilots"
  ON public.pilots FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin full access on pilot_participants"
  ON public.pilot_participants FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX idx_pilot_participants_pilot ON public.pilot_participants(pilot_id);
CREATE INDEX idx_pilot_participants_user ON public.pilot_participants(user_id);
CREATE INDEX idx_pilots_status ON public.pilots(status);
