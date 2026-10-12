-- Executive metrics, AI operations, data governance, exports and document center.

CREATE TABLE IF NOT EXISTS public.executive_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_value numeric,
  dimension jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_key text,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  cost_usd numeric(18,8),
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded','failed')),
  error_code text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  version integer NOT NULL,
  content text NOT NULL,
  model_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_key, version)
);

CREATE TABLE IF NOT EXISTS public.data_governance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','delete','rectify','restrict','legal_hold')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','completed','rejected','cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_lineage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_or_field text NOT NULL,
  source_system text NOT NULL,
  source_object text,
  transformation text,
  refresh_cadence text,
  owner text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','expired')),
  row_count integer,
  storage_path text,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.document_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('user','organization','contract','funding_case','support_ticket','project')),
  owner_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','archived','legal_hold')),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.document_records(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  checksum text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_exec_metric_key ON public.executive_metric_snapshots(metric_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_events(feature_key, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON public.data_governance_requests(status, due_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.admin_export_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.document_records(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.document_records(status, expires_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'executive_metric_snapshots','ai_usage_events','ai_prompt_versions',
    'data_governance_requests','data_lineage_entries','admin_export_jobs',
    'document_records','document_versions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY admin_platform_read ON public.%I FOR SELECT TO authenticated USING (public.is_admin_platform_user())', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;
