-- ============================================================
-- Migration: pilot_reports (persisted generated reports)
-- Date: 2026-04-20
--
-- Problem:
--   Today /admin/pilotos Step5Report builds the PDF client-side from
--   /api/admin/pilots/[id]/report and never persists it. Every click
--   re-runs jsPDF in the browser with live data — there is no audit
--   trail, no way to re-download yesterday's version, and the
--   superadmin cannot share the file URL externally.
--
-- Fix:
--   Add a pilot_reports table that stores one row per generated
--   report. The file itself (DOCX, editable by the admin) lives in
--   the existing 'reports' Storage bucket under
--   pilots/<pilot_id>/<timestamp>-<variant>.docx. The row stores
--   metadata + file_path so the UI can list and re-download.
--
--   variant:
--     'named'     — participant names visible in testimonials + annex
--     'anonymous' — names replaced with P-001, P-002, etc.
--
--   metadata snapshot captures counts/scores at generation time so
--   the listing can show "Generated on 2026-04-20 · 14 respuestas ·
--   3.1/4 avg" even months later, without re-querying session state.
--
-- Compatibility:
--   • 'reports' bucket already exists (see 20260317000000).
--   • RLS: superadmin full access, admins read (same pattern as
--     technical_reports in that migration).
--
-- Rollback:
--   DROP TABLE public.pilot_reports;
-- ============================================================

CREATE TABLE public.pilot_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id        UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  variant         TEXT NOT NULL CHECK (variant IN ('named', 'anonymous')),
  file_path       TEXT NOT NULL,
  file_size_bytes INTEGER,
  metadata        JSONB,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pilot_reports_pilot ON public.pilot_reports(pilot_id);
CREATE INDEX idx_pilot_reports_created ON public.pilot_reports(created_at DESC);

ALTER TABLE public.pilot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pilot reports"
  ON public.pilot_reports FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "Superadmin manages pilot reports"
  ON public.pilot_reports FOR ALL TO authenticated
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

COMMENT ON TABLE public.pilot_reports IS
  'Persisted generated pilot reports (DOCX). Files live in the reports bucket under pilots/<pilot_id>/<ts>-<variant>.docx; this table indexes them with metadata snapshots.';
