-- Technical reports section for supradmin
-- Stores uploaded PDF/documents with metadata, summary, and user notes

CREATE TABLE IF NOT EXISTS technical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE technical_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reports"
  ON technical_reports FOR SELECT
  USING (public.get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "Superadmin full access on reports"
  ON technical_reports FOR ALL
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (public.get_my_role() = 'superadmin');

-- Storage bucket for reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Superadmin upload reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND public.get_my_role() = 'superadmin');

CREATE POLICY "Superadmin delete reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND public.get_my_role() = 'superadmin');

CREATE POLICY "Public read reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports');
