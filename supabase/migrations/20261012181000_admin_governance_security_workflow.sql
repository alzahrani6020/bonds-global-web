-- Governance, RBAC, Security Operations, Feature Flags, Entitlements, Workflow.

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  permission_key text PRIMARY KEY,
  description text,
  risk_level text NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('low','normal','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role text NOT NULL,
  permission_key text NOT NULL REFERENCES public.admin_permissions(permission_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.admin_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(permission_key) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'high' CHECK (risk_level IN ('normal','high','critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','executed','failed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  ip_address text,
  user_agent text,
  device_fingerprint text,
  country text,
  request_id text,
  risk_score numeric(5,2) CHECK (risk_score >= 0 AND risk_score <= 100),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','false_positive')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.trusted_admin_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  label text,
  trusted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trusted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS public.break_glass_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  flag_key text PRIMARY KEY,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  environments jsonb NOT NULL DEFAULT '["production"]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL REFERENCES public.feature_flags(flag_key) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','organization','tier','country')),
  subject_key text NOT NULL,
  enabled boolean NOT NULL,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, subject_type, subject_key)
);

CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','organization','tier')),
  subject_key text NOT NULL,
  entitlement_key text NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_key, entitlement_key)
);

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  entity_type text,
  entity_id text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.workflow_rules(id) ON DELETE SET NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  output jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','high','critical')),
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_access_grants_user ON public.admin_access_grants(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.admin_approval_requests(status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON public.security_events(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.admin_tasks(status, priority, due_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.operational_alerts(status, severity, created_at DESC);

INSERT INTO public.admin_permissions (permission_key, description, risk_level) VALUES
('users.read','Read user profiles and user 360 data','low'),
('users.write','Modify user operational data','high'),
('crm.read','Read CRM organizations and opportunities','low'),
('crm.write','Modify CRM organizations and opportunities','normal'),
('support.read','Read support tickets','low'),
('support.write','Modify support tickets','normal'),
('finance.read','Read financial operations','high'),
('finance.refund','Request or execute refunds','critical'),
('finance.reconcile','Resolve reconciliation exceptions','high'),
('security.read','Read security operations','high'),
('security.manage','Modify security controls','critical'),
('rbac.manage','Modify roles, permissions and grants','critical'),
('approvals.review','Approve governed actions','critical'),
('features.manage','Modify feature flags and entitlements','high'),
('workflow.manage','Modify automation workflows','high'),
('incidents.manage','Manage incidents and runbooks','high'),
('platform.read','Read health, jobs, integrations and configuration state','normal'),
('platform.manage','Modify platform operational settings','critical'),
('ai.read','Read AI usage and cost telemetry','normal'),
('ai.manage','Modify AI prompt versions and kill switches','high'),
('data.read','Read governance and lineage data','high'),
('data.manage','Manage exports, privacy and retention workflows','critical'),
('documents.read','Read document metadata','high'),
('documents.manage','Manage document records and versions','high')
ON CONFLICT (permission_key) DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_permissions','admin_role_permissions','admin_access_grants','admin_approval_requests',
    'security_events','trusted_admin_devices','break_glass_events','feature_flags',
    'feature_flag_overrides','entitlements','admin_tasks','workflow_rules','workflow_runs',
    'operational_alerts'
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


-- Default role-to-permission mapping. Fine-grained grants can extend these temporarily.
INSERT INTO public.admin_role_permissions (role, permission_key)
SELECT 'super_admin', permission_key FROM public.admin_permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role, permission_key) VALUES
('admin','users.read'),('admin','users.write'),
('admin','crm.read'),('admin','crm.write'),
('admin','support.read'),('admin','support.write'),
('admin','finance.read'),('admin','finance.reconcile'),
('admin','security.read'),('admin','features.manage'),('admin','workflow.manage'),
('admin','incidents.manage'),('admin','platform.read'),
('admin','ai.read'),('admin','data.read'),('admin','documents.read'),('admin','documents.manage'),
('support','users.read'),('support','crm.read'),('support','support.read'),('support','support.write'),
('support','platform.read'),('support','documents.read'),
('viewer','users.read'),('viewer','crm.read'),('viewer','support.read'),
('viewer','platform.read'),('viewer','documents.read')
ON CONFLICT DO NOTHING;
