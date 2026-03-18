-- CRM: Universities database for commercial tracking
CREATE TABLE public.crm_universities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  country         TEXT NOT NULL,
  city            TEXT NOT NULL,
  website         TEXT,
  type            TEXT NOT NULL CHECK (type IN ('pública', 'privada')),
  program_name    TEXT NOT NULL DEFAULT 'Psicología',
  contact_email   TEXT,
  contact_name    TEXT,
  contact_phone   TEXT,
  estimated_students INTEGER,
  status          TEXT NOT NULL DEFAULT 'prospecto' CHECK (status IN ('prospecto', 'contactado', 'en conversación', 'propuesta enviada', 'negociación', 'cliente', 'descartado')),
  priority        TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  notes           TEXT,
  next_followup   DATE,
  google_sheets_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRM: Follow-up notes / activity log
CREATE TABLE public.crm_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   UUID NOT NULL REFERENCES public.crm_universities(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('nota', 'llamada', 'email', 'reunión', 'demo', 'otro')),
  description     TEXT NOT NULL,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- Only superadmin has access to CRM
CREATE POLICY "Superadmin full access on crm_universities"
  ON public.crm_universities FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin full access on crm_activities"
  ON public.crm_activities FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Indexes
CREATE INDEX idx_crm_universities_country ON public.crm_universities(country);
CREATE INDEX idx_crm_universities_status ON public.crm_universities(status);
CREATE INDEX idx_crm_activities_university ON public.crm_activities(university_id);
