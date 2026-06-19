-- Enterprise RBAC Schema
-- Roles: CEO, Partner, Finance Manager, Project Manager, Consultant, Data Entry, Client

CREATE TABLE IF NOT EXISTS public.enterprise_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('CEO','Partner','Finance Manager','Project Manager','Consultant','Data Entry','Client')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL CHECK (action IN ('view','create','edit','delete','approve','export')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_role_permissions (
  role_id uuid NOT NULL REFERENCES public.enterprise_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.enterprise_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.enterprise_user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.enterprise_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_user_roles_user_id ON public.enterprise_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_role_permissions_role_id ON public.enterprise_role_permissions(role_id);

ALTER TABLE public.enterprise_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage roles and assignments
CREATE POLICY enterprise_roles_admin ON public.enterprise_roles FOR ALL TO authenticated USING (public.is_advisory_manager()) WITH CHECK (public.is_advisory_manager());
CREATE POLICY enterprise_permissions_admin ON public.enterprise_permissions FOR ALL TO authenticated USING (public.is_advisory_manager()) WITH CHECK (public.is_advisory_manager());
CREATE POLICY enterprise_role_permissions_admin ON public.enterprise_role_permissions FOR ALL TO authenticated USING (public.is_advisory_manager()) WITH CHECK (public.is_advisory_manager());
CREATE POLICY enterprise_user_roles_admin ON public.enterprise_user_roles FOR ALL TO authenticated USING (public.is_advisory_manager()) WITH CHECK (public.is_advisory_manager());

-- Seed roles
INSERT INTO public.enterprise_roles (name, description) VALUES
  ('CEO', 'Full platform access and executive reporting'),
  ('Partner', 'Strategic oversight and approval authority'),
  ('Finance Manager', 'Financial data, subscriptions, invoices, reports'),
  ('Project Manager', 'Project and workflow management'),
  ('Consultant', 'Advisory work and studies'),
  ('Data Entry', 'Create and edit records, no approval'),
  ('Client', 'View own data and reports only')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO public.enterprise_permissions (code, module, action, description) VALUES
  ('dashboard.view', 'dashboard', 'view', 'View executive dashboard'),
  ('advisory.view', 'advisory', 'view', 'View advisory clients and projects'),
  ('advisory.create', 'advisory', 'create', 'Create advisory records'),
  ('advisory.edit', 'advisory', 'edit', 'Edit advisory records'),
  ('advisory.delete', 'advisory', 'delete', 'Delete advisory records'),
  ('advisory.approve', 'advisory', 'approve', 'Approve advisory workflow transitions'),
  ('advisory.export', 'advisory', 'export', 'Export advisory data'),
  ('recovery.view', 'recovery', 'view', 'View recovery assets'),
  ('recovery.create', 'recovery', 'create', 'Create recovery records'),
  ('recovery.edit', 'recovery', 'edit', 'Edit recovery records'),
  ('recovery.delete', 'recovery', 'delete', 'Delete recovery records'),
  ('recovery.approve', 'recovery', 'approve', 'Approve recovery write-offs'),
  ('recovery.export', 'recovery', 'export', 'Export recovery data'),
  ('city.view', 'city', 'view', 'View city intelligence'),
  ('city.create', 'city', 'create', 'Create city records'),
  ('city.edit', 'city', 'edit', 'Edit city records'),
  ('city.delete', 'city', 'delete', 'Delete city records'),
  ('city.export', 'city', 'export', 'Export city data'),
  ('ai_advisor.view', 'ai_advisor', 'view', 'View AI advisor reports'),
  ('ai_advisor.export', 'ai_advisor', 'export', 'Export AI advisor reports'),
  ('users.view', 'users', 'view', 'View users'),
  ('users.edit', 'users', 'edit', 'Edit users'),
  ('subscriptions.view', 'subscriptions', 'view', 'View subscriptions'),
  ('subscriptions.export', 'subscriptions', 'export', 'Export subscriptions'),
  ('settings.view', 'settings', 'view', 'View settings'),
  ('settings.edit', 'settings', 'edit', 'Edit settings')
ON CONFLICT (code) DO NOTHING;

-- Helper: assign all permissions to a role
CREATE OR REPLACE FUNCTION public.grant_all_permissions(p_role_name text)
RETURNS void AS $$
DECLARE
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = p_role_name;
  IF v_role_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign default permissions
SELECT public.grant_all_permissions('CEO');
SELECT public.grant_all_permissions('Partner');

-- Finance Manager
DO $$
DECLARE v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = 'Finance Manager';
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  WHERE module IN ('dashboard','subscriptions','advisory','recovery','ai_advisor')
  ON CONFLICT DO NOTHING;
END $$;

-- Project Manager
DO $$
DECLARE v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = 'Project Manager';
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  WHERE module IN ('dashboard','advisory','recovery','city')
  ON CONFLICT DO NOTHING;
END $$;

-- Consultant
DO $$
DECLARE v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = 'Consultant';
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  WHERE module IN ('advisory','city') AND action IN ('view','create','edit','export')
  ON CONFLICT DO NOTHING;
END $$;

-- Data Entry
DO $$
DECLARE v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = 'Data Entry';
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  WHERE action IN ('view','create','edit')
  ON CONFLICT DO NOTHING;
END $$;

-- Client
DO $$
DECLARE v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.enterprise_roles WHERE name = 'Client';
  INSERT INTO public.enterprise_role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.enterprise_permissions
  WHERE code IN ('advisory.view','recovery.view','ai_advisor.view')
  ON CONFLICT DO NOTHING;
END $$;

-- RPC: get permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS TABLE(permission_code text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ep.code
  FROM public.enterprise_user_roles eur
  JOIN public.enterprise_role_permissions erp ON erp.role_id = eur.role_id
  JOIN public.enterprise_permissions ep ON ep.id = erp.permission_id
  WHERE eur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
