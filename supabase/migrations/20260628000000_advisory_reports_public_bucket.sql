-- Make advisory-reports bucket public so clients can download approved PDFs via public URL.
-- Report filenames include an unguessable reference number.

UPDATE storage.buckets
SET public = true
WHERE id = 'advisory-reports';

-- Simplify select policy: authenticated users can read any object in advisory-reports bucket.
-- Filenames are unguessable; bucket listing remains disabled by default Supabase behavior.
DROP POLICY IF EXISTS advisory_reports_storage_select ON storage.objects;
CREATE POLICY advisory_reports_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'advisory-reports');
