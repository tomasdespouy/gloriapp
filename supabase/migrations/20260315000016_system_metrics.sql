-- ============================================================
-- SYSTEM METRICS: Store performance and usage metrics
-- ============================================================

CREATE TABLE public.system_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_event ON public.system_metrics(event);
CREATE INDEX idx_system_metrics_created ON public.system_metrics(created_at);

-- Auto-cleanup: keep only last 30 days
-- (can be run via cron or Supabase Edge Function)

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view metrics"
  ON public.system_metrics FOR SELECT TO authenticated
  USING (public.is_admin_or_superadmin());

CREATE POLICY "System insert metrics"
  ON public.system_metrics FOR INSERT TO authenticated
  WITH CHECK (true);
