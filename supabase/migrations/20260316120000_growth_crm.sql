-- Growth CRM tables for outreach to psychology schools in Iberoamerica

-- ── Schools (target institutions) ─────────────────────────────────
CREATE TABLE public.growth_schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  country     TEXT NOT NULL,
  city        TEXT,
  website     TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'lead'
                CHECK (status IN ('lead', 'contacted', 'interested', 'negotiating', 'client', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.growth_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_schools" ON public.growth_schools
  FOR ALL USING (public.is_superadmin());

-- ── Contacts (decision makers at schools) ─────────────────────────
CREATE TABLE public.growth_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.growth_schools(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role_title  TEXT,           -- e.g. "Director de carrera", "Decano"
  phone       TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'bounced', 'unsubscribed', 'invalid')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.growth_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_contacts" ON public.growth_contacts
  FOR ALL USING (public.is_superadmin());

-- ── Campaigns (manual email blasts) ──────────────────────────────
CREATE TABLE public.growth_campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  html_body   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  sent_at     TIMESTAMPTZ,
  total_sent  INT NOT NULL DEFAULT 0,
  total_opened INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.growth_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_campaigns" ON public.growth_campaigns
  FOR ALL USING (public.is_superadmin());

-- ── Drip sequences ───────────────────────────────────────────────
CREATE TABLE public.growth_drip_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.growth_drip_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_drip_sequences" ON public.growth_drip_sequences
  FOR ALL USING (public.is_superadmin());

-- ── Drip steps (emails within a sequence) ────────────────────────
CREATE TABLE public.growth_drip_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES public.growth_drip_sequences(id) ON DELETE CASCADE,
  step_order    INT NOT NULL,
  delay_days    INT NOT NULL DEFAULT 0,   -- days after previous step
  subject       TEXT NOT NULL,
  html_body     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, step_order)
);

ALTER TABLE public.growth_drip_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_drip_steps" ON public.growth_drip_steps
  FOR ALL USING (public.is_superadmin());

-- ── Email log (individual send records) ──────────────────────────
CREATE TABLE public.growth_email_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID NOT NULL REFERENCES public.growth_contacts(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES public.growth_campaigns(id) ON DELETE SET NULL,
  drip_step_id  UUID REFERENCES public.growth_drip_steps(id) ON DELETE SET NULL,
  subject       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  resend_id     TEXT,           -- Resend message ID for tracking
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ
);

ALTER TABLE public.growth_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_email_log" ON public.growth_email_log
  FOR ALL USING (public.is_superadmin());

-- ── Contact-sequence enrollment ──────────────────────────────────
CREATE TABLE public.growth_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID NOT NULL REFERENCES public.growth_contacts(id) ON DELETE CASCADE,
  sequence_id   UUID NOT NULL REFERENCES public.growth_drip_sequences(id) ON DELETE CASCADE,
  current_step  INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  next_send_at  TIMESTAMPTZ,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id, sequence_id)
);

ALTER TABLE public.growth_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_growth_enrollments" ON public.growth_enrollments
  FOR ALL USING (public.is_superadmin());

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_growth_contacts_school ON public.growth_contacts(school_id);
CREATE INDEX idx_growth_contacts_email ON public.growth_contacts(email);
CREATE INDEX idx_growth_email_log_contact ON public.growth_email_log(contact_id);
CREATE INDEX idx_growth_email_log_campaign ON public.growth_email_log(campaign_id);
CREATE INDEX idx_growth_enrollments_next ON public.growth_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX idx_growth_drip_steps_seq ON public.growth_drip_steps(sequence_id, step_order);
