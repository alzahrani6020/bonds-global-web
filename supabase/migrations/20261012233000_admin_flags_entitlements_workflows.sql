-- Feature Flags, Entitlements, Workflows and Operations Queue

CREATE TABLE IF NOT EXISTS public.admin_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  default_variant text NOT NULL DEFAULT 'off',
  rollout_percentage integer NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  starts_at timestamptz,
  expires_at timestamptz,
  previous_state jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_feature_flag_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.admin_feature_flags(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user','tier','organization','country','percentage')),
  target_value text NOT NULL,
  variant text NOT NULL DEFAULT 'on',
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_feature_flag_rules_flag ON public.admin_feature_flag_rules(flag_id, priority);

CREATE TABLE IF NOT EXISTS public.admin_entitlements (
  key text PRIMARY KEY,
  description text,
  value_type text NOT NULL DEFAULT 'boolean' CHECK (value_type IN ('boolean','integer','decimal','text','json')),
  default_value jsonb NOT NULL DEFAULT 'false',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_plan_entitlements (
  tier text NOT NULL,
  entitlement_key text NOT NULL REFERENCES public.admin_entitlements(key) ON DELETE CASCADE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tier, entitlement_key)
);

CREATE TABLE IF NOT EXISTS public.admin_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL REFERENCES public.admin_entitlements(key) ON DELETE CASCADE,
  value jsonb NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_user ON public.admin_entitlement_overrides(user_id, entitlement_key);
CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_org ON public.admin_entitlement_overrides(organization_id, entitlement_key);

CREATE TABLE IF NOT EXISTS public.admin_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  trigger_type text NOT NULL CHECK (trigger_type IN ('event','schedule','condition','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  conditions jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 1,
  previous_version jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.admin_workflows(id) ON DELETE CASCADE,
  trigger_payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  output jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_workflow_runs_status ON public.admin_workflow_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  entity_type text,
  entity_id text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  due_at timestamptz,
  sla_due_at timestamptz,
  source text,
  request_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_queue ON public.admin_tasks(status, priority, due_at);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned ON public.admin_tasks(assigned_to, status);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','high','critical')),
  entity_type text,
  entity_id text,
  request_id text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','ignored')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_queue ON public.admin_alerts(status, severity, created_at DESC);

ALTER TABLE public.admin_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_feature_flag_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_feature_flags FROM anon, authenticated;
REVOKE ALL ON public.admin_feature_flag_rules FROM anon, authenticated;
REVOKE ALL ON public.admin_entitlements FROM anon, authenticated;
REVOKE ALL ON public.admin_plan_entitlements FROM anon, authenticated;
REVOKE ALL ON public.admin_entitlement_overrides FROM anon, authenticated;
REVOKE ALL ON public.admin_workflows FROM anon, authenticated;
REVOKE ALL ON public.admin_workflow_runs FROM anon, authenticated;
REVOKE ALL ON public.admin_tasks FROM anon, authenticated;
REVOKE ALL ON public.admin_alerts FROM anon, authenticated;


INSERT INTO public.admin_permissions(permission, description, risk_level) VALUES
('product.flags','Manage feature flags','high'),
('entitlements.manage','Manage entitlements and overrides','high'),
('workflow.manage','Manage automated workflows','high'),
('operations.manage','Manage operational tasks and alerts','normal')
ON CONFLICT (permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role, permission)
SELECT role, permission FROM (VALUES
  ('super_admin','product.flags'),('super_admin','entitlements.manage'),('super_admin','workflow.manage'),('super_admin','operations.manage'),
  ('admin','product.flags'),('admin','entitlements.manage'),('admin','workflow.manage'),('admin','operations.manage'),
  ('support','operations.manage')
) AS x(role, permission)
ON CONFLICT (role, permission) DO NOTHING;
