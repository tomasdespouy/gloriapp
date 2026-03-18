-- Create storage bucket for research papers/documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('research', 'research', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read
CREATE POLICY "Public read research" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'research');

-- Allow superadmins to upload
CREATE POLICY "Superadmin upload research" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research' AND public.get_my_role() = 'superadmin');

-- Allow superadmins to delete
CREATE POLICY "Superadmin delete research" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'research' AND public.get_my_role() = 'superadmin');
