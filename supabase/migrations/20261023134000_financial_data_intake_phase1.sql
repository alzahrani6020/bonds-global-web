-- Phase 1: auditable validated financial datasets.
-- Reuses existing client-documents storage and existing service execution gateway.

CREATE TABLE IF NOT EXISTS public.financial_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NULL,
  service_code text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('file','manual','mixed')),
  source_file_name text NULL,
  source_storage_path text NULL,
  source_file_version text NULL,
  source_mime_type text NULL,
  extracted_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','validated','executed','error')),
  execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_datasets_user_service
  ON public.financial_datasets(user_id, service_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_datasets_project
  ON public.financial_datasets(project_id)
  WHERE project_id IS NOT NULL;

ALTER TABLE public.financial_datasets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_datasets_owner_select ON public.financial_datasets;
CREATE POLICY financial_datasets_owner_select ON public.financial_datasets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS financial_datasets_owner_insert ON public.financial_datasets;
CREATE POLICY financial_datasets_owner_insert ON public.financial_datasets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS financial_datasets_owner_update ON public.financial_datasets;
CREATE POLICY financial_datasets_owner_update ON public.financial_datasets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.financial_datasets IS
  'Phase-1 reviewed financial dataset envelope preserving extracted values, provenance, corrections, validation and execution evidence.';
