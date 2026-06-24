-- Extend ai_advisor_reports to support official branded PDF reports

ALTER TABLE public.ai_advisor_reports
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS reference_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS advisor_name text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Storage bucket for advisory reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('advisory-reports', 'advisory-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: advisory users can manage; clients can read their own reports
DROP POLICY IF EXISTS advisory_reports_storage_select ON storage.objects;
CREATE POLICY advisory_reports_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'advisory-reports'
    AND (
      public.is_advisory_user()
      OR EXISTS (
        SELECT 1 FROM public.ai_advisor_reports r
        JOIN public.advisory_clients c ON c.id = r.client_id
        WHERE r.pdf_url LIKE '%' || storage.objects.name || '%'
          AND c.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS advisory_reports_storage_insert ON storage.objects;
CREATE POLICY advisory_reports_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'advisory-reports'
    AND public.is_advisory_user()
  );

DROP POLICY IF EXISTS advisory_reports_storage_delete ON storage.objects;
CREATE POLICY advisory_reports_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'advisory-reports'
    AND public.is_advisory_user()
  );

-- Helper function to generate reference numbers (BONDS-YYYY-XXXXX)
CREATE OR REPLACE FUNCTION public.generate_report_reference_number()
RETURNS text AS $$
DECLARE
  year text;
  seq int;
BEGIN
  year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO seq
  FROM public.ai_advisor_reports
  WHERE reference_number LIKE 'BONDS-' || year || '-%';
  RETURN 'BONDS-' || year || '-' || lpad(seq::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
