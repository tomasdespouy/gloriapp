-- Pilot self-enrollment + digital consent
-- Adds:
--   1. New columns on pilots: enrollment_slug (public link), consent_text,
--      consent_version, test_mode (skip emails, show creds on screen).
--   2. New table pilot_consents: one row per signed consent, with full
--      audit trail (IP, user agent, snapshot of signed text).

-- ─── 1. New columns on pilots ─────────────────────────────────────────
ALTER TABLE public.pilots
  ADD COLUMN IF NOT EXISTS enrollment_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS consent_text    TEXT,
  ADD COLUMN IF NOT EXISTS consent_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS test_mode       BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pilots_enrollment_slug
  ON public.pilots(enrollment_slug)
  WHERE enrollment_slug IS NOT NULL;

COMMENT ON COLUMN public.pilots.enrollment_slug IS
  'URL-safe public identifier for the consent enrollment page (/piloto/{slug}/consentimiento). Distinct from id so it can be human-readable.';
COMMENT ON COLUMN public.pilots.consent_text IS
  'Markdown text of the informed-consent document, editable from the admin pilot detail screen. Snapshotted into pilot_consents on signing.';
COMMENT ON COLUMN public.pilots.consent_version IS
  'Free-form version label (e.g. "v1", "2026-04-01") that travels with each signed consent for traceability.';
COMMENT ON COLUMN public.pilots.test_mode IS
  'When true, the public enrollment flow shows the generated credentials on screen and does not require a real inbox. Used by the GlorIA team to dry-run a pilot end to end.';

-- ─── 2. pilot_consents table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pilot_consents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id              UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  -- Optional FK to pilot_participants. NULL when the participant
  -- self-enrolled via the public link without being pre-loaded from CSV.
  pilot_participant_id  UUID REFERENCES public.pilot_participants(id) ON DELETE SET NULL,

  -- Identification (RUT intentionally omitted per UBO/Arequipa pilot scope)
  full_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  age                   INTEGER CHECK (age IS NULL OR (age BETWEEN 15 AND 99)),
  gender                TEXT CHECK (gender IS NULL OR gender IN ('femenino', 'masculino', 'no_binario', 'prefiere_no_decir')),
  role                  TEXT NOT NULL CHECK (role IN ('estudiante', 'docente', 'coordinador')),
  university            TEXT,

  -- Audit trail of the signing event
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_name           TEXT NOT NULL,            -- typed signature
  signed_ip             INET,
  signed_user_agent     TEXT,
  consent_version       TEXT NOT NULL,
  consent_text_snapshot TEXT NOT NULL,            -- exact text the user agreed to

  -- Linked auth user (created on consent submission)
  user_id               UUID REFERENCES auth.users(id),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (pilot_id, email)
);

CREATE INDEX IF NOT EXISTS idx_pilot_consents_pilot     ON public.pilot_consents(pilot_id);
CREATE INDEX IF NOT EXISTS idx_pilot_consents_user      ON public.pilot_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_consents_signed_at ON public.pilot_consents(signed_at DESC);

-- RLS — superadmin only (consents contain identifying audit data)
ALTER TABLE public.pilot_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on pilot_consents"
  ON public.pilot_consents FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

COMMENT ON TABLE public.pilot_consents IS
  'Digital informed-consent records for pilot participants. Each row is the legal evidence that a person agreed to participate, including a snapshot of the exact consent text they signed (so future edits to pilots.consent_text do not retroactively rewrite history).';
