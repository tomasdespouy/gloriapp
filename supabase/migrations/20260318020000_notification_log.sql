-- Notification log for tracking sent communications
CREATE TABLE public.notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  filters         JSONB DEFAULT '{}',
  sent_by         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on notification_log"
  ON public.notification_log FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX idx_notification_log_created ON public.notification_log(created_at DESC);
