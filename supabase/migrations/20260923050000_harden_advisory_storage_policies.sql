-- Harden advisory storage policies.
-- Do not modify table-level grants on storage.objects because they are shared
-- across all Storage buckets. Restrict access with bucket-specific RLS policies.

-- ---------------------------------------------------------------------------
-- advisory-documents
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "advisory_storage_select"
  ON storage.objects;

DROP POLICY IF EXISTS "advisory_storage_insert"
  ON storage.objects;

DROP POLICY IF EXISTS "advisory_storage_delete"
  ON storage.objects;

CREATE POLICY "advisory_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'advisory-documents'
    AND public.is_advisory_user()
  );

CREATE POLICY "advisory_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'advisory-documents'
    AND public.is_advisory_user()
  );

CREATE POLICY "advisory_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'advisory-documents'
    AND public.is_advisory_user()
  );

-- ---------------------------------------------------------------------------
-- advisory-reports
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "advisory_reports_storage_select"
  ON storage.objects;

DROP POLICY IF EXISTS "advisory_reports_storage_insert"
  ON storage.objects;

DROP POLICY IF EXISTS "advisory_reports_storage_delete"
  ON storage.objects;

CREATE POLICY "advisory_reports_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'advisory-reports'
    AND public.is_advisory_user()
  );

CREATE POLICY "advisory_reports_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'advisory-reports'
    AND public.is_advisory_user()
  );

CREATE POLICY "advisory_reports_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'advisory-reports'
    AND public.is_advisory_user()
  );
