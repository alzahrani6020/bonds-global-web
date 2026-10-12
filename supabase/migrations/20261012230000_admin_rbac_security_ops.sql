-- Advanced Admin RBAC and Security Operations

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  permission text PRIMARY KEY,
  description text,
  risk_level text NOT NULL DEFAULT 'normal'
    CHECK (risk_level IN ('low','normal','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_permissions(permission, description, risk_level) VALUES
('users.read','Read users','low'),
('users.write','Modify users','high'),
('users.export','Export user data','high'),
('billing.read','Read billing','normal'),
('billing.refund','Create or approve refunds','critical'),
('billing.reconcile','Resolve financial reconciliation','high'),
('messages.read','Read support/contact messages','normal'),
('messages.write','Assign or modify messages','normal'),
('support.manage','Manage support tickets','normal'),
('crm.read','Read CRM','normal'),
('crm.write','Modify CRM','high'),
('security.read','Read security posture','high'),
('security.manage','Modify security controls','critical'),
('roles.read','Read roles and permissions','high'),
('roles.manage','Modify roles and permissions','critical'),
('audit.read','Read audit logs','high'),
('platform.health','Read platform health','normal'),
('platform.manage','Modify platform configuration','critical')
ON CONFLICT (permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role text NOT NULL,
  permission text NOT NULL REFERENCES public.admin_permissions(permission) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role, permission)
);

INSERT INTO public.admin_role_permissions(role, permission)
SELECT role, permission FROM (VALUES
  ('super_admin','users.read'),('super_admin','users.write'),('super_admin','users.export'),
  ('super_admin','billing.read'),('super_admin','billing.refund'),('super_admin','billing.reconcile'),
  ('super_admin','messages.read'),('super_admin','messages.write'),('super_admin','support.manage'),
  ('super_admin','crm.read'),('super_admin','crm.write'),
  ('super_admin','security.read'),('super_admin','security.manage'),
  ('super_admin','roles.read'),('super_admin','roles.manage'),('super_admin','audit.read'),
  ('super_admin','platform.health'),('super_admin','platform.manage'),
  ('admin','users.read'),('admin','users.write'),('admin','users.export'),
  ('admin','billing.read'),('admin','billing.reconcile'),
  ('admin','messages.read'),('admin','messages.write'),('admin','support.manage'),
  ('admin','crm.read'),('admin','crm.write'),('admin','security.read'),('admin','roles.read'),
  ('admin','audit.read'),('admin','platform.health'),
  ('support','users.read'),('support','messages.read'),('support','messages.write'),
  ('support','support.manage'),('support','crm.read'),('support','platform.health'),
  ('viewer','platform.health')
) AS x(role, permission)
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_user_permission_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL REFERENCES public.admin_permissions(permission) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('allow','deny')),
  reason text,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, permission)
);

CREATE TABLE IF NOT EXISTS public.admin_temporary_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL REFERENCES public.admin_permissions(permission) ON DELETE CASCADE,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_temporary_access_user
  ON public.admin_temporary_access(user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.admin_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL REFERENCES public.admin_permissions(permission) ON DELETE CASCADE,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_delegations_to_user
  ON public.admin_delegations(to_user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL REFERENCES public.admin_permissions(permission) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','executed','cancelled')),
  required_approvals integer NOT NULL DEFAULT 1 CHECK (required_approvals BETWEEN 1 AND 5),
  approvals jsonb NOT NULL DEFAULT '[]',
  expires_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status
  ON public.admin_approval_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','low','medium','high','critical')),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  ip_address text,
  user_agent text,
  device_fingerprint text,
  country text,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}',
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_events_created
  ON public.admin_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_events_user
  ON public.admin_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_events_severity
  ON public.admin_security_events(severity);

CREATE TABLE IF NOT EXISTS public.admin_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  label text,
  trusted_until timestamptz,
  last_seen_at timestamptz,
  last_ip text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS public.admin_break_glass_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_temporary_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_break_glass_access ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_permissions FROM anon, authenticated;
REVOKE ALL ON public.admin_role_permissions FROM anon, authenticated;
REVOKE ALL ON public.admin_user_permission_overrides FROM anon, authenticated;
REVOKE ALL ON public.admin_temporary_access FROM anon, authenticated;
REVOKE ALL ON public.admin_delegations FROM anon, authenticated;
REVOKE ALL ON public.admin_approval_requests FROM anon, authenticated;
REVOKE ALL ON public.admin_security_events FROM anon, authenticated;
REVOKE ALL ON public.admin_trusted_devices FROM anon, authenticated;
REVOKE ALL ON public.admin_break_glass_access FROM anon, authenticated;
