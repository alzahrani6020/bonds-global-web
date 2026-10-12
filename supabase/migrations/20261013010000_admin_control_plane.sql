-- Admin control-plane completion: session revocation, access policies and workflow scheduling.

CREATE TABLE IF NOT EXISTS public.admin_revoked_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  reason text NOT NULL,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_admin_revoked_sessions_user ON public.admin_revoked_sessions(user_id,revoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_revoked_sessions_session ON public.admin_revoked_sessions(session_id);

CREATE TABLE IF NOT EXISTS public.admin_access_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  allowed_countries text[] NOT NULL DEFAULT '{}',
  denied_countries text[] NOT NULL DEFAULT '{}',
  allowed_ips text[] NOT NULL DEFAULT '{}',
  denied_ips text[] NOT NULL DEFAULT '{}',
  require_trusted_device boolean NOT NULL DEFAULT false,
  max_session_minutes integer CHECK (max_session_minutes IS NULL OR max_session_minutes BETWEEN 5 AND 10080),
  applies_to_roles text[] NOT NULL DEFAULT '{super_admin,admin,support}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_access_policies_enabled ON public.admin_access_policies(enabled,priority);

CREATE TABLE IF NOT EXISTS public.admin_workflow_schedule_state (
  workflow_id uuid PRIMARY KEY REFERENCES public.admin_workflows(id) ON DELETE CASCADE,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_revoked_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_workflow_schedule_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_revoked_sessions,public.admin_access_policies,public.admin_workflow_schedule_state FROM anon,authenticated;

INSERT INTO public.admin_permissions(permission,description,risk_level) VALUES
('security.sessions.manage','Revoke admin sessions and manage trusted devices','critical'),
('security.policies.manage','Manage admin IP/Geo/device/session policies','critical')
ON CONFLICT(permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role,permission)
SELECT role,permission FROM (VALUES
('super_admin','security.sessions.manage'),('super_admin','security.policies.manage')
) AS x(role,permission) ON CONFLICT(role,permission) DO NOTHING;
