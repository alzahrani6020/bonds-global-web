-- Executive analytics and AI operations telemetry.

CREATE TABLE IF NOT EXISTS public.admin_ai_operation_events (
  id bigserial PRIMARY KEY,
  feature text NOT NULL,
  model text,
  provider text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text,
  prompt_version text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(15,6) NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','timeout','cancelled')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_ai_events_created ON public.admin_ai_operation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_ai_events_feature ON public.admin_ai_operation_events(feature,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_ai_events_model ON public.admin_ai_operation_events(model,created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  version integer NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE(prompt_key,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompt_active
  ON public.admin_ai_prompt_versions(prompt_key) WHERE status='active';

CREATE TABLE IF NOT EXISTS public.admin_ai_kill_switches (
  feature text PRIMARY KEY,
  disabled boolean NOT NULL DEFAULT false,
  reason text,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disabled_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  metric_key text NOT NULL,
  value numeric(20,4),
  dimensions jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'computed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_date,metric_key,dimensions)
);
CREATE INDEX IF NOT EXISTS idx_admin_metric_snapshots_key ON public.admin_metric_snapshots(metric_key,metric_date DESC);

ALTER TABLE public.admin_ai_operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ai_kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_metric_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_ai_operation_events, public.admin_ai_prompt_versions, public.admin_ai_kill_switches, public.admin_metric_snapshots FROM anon, authenticated;

INSERT INTO public.admin_permissions(permission,description,risk_level) VALUES
('analytics.executive','Read executive analytics','high'),
('ai.operations.read','Read AI operations','normal'),
('ai.operations.manage','Manage AI prompts and kill switches','critical')
ON CONFLICT(permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role,permission)
SELECT role,permission FROM (VALUES
('super_admin','analytics.executive'),('super_admin','ai.operations.read'),('super_admin','ai.operations.manage'),
('admin','analytics.executive'),('admin','ai.operations.read'),
('support','ai.operations.read')
) AS x(role,permission) ON CONFLICT(role,permission) DO NOTHING;
