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
-- Enterprise Workflow Engine
-- Tracks state-machine transitions for clients, projects, assets, studies, funding requests.

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL UNIQUE CHECK (entity_type IN ('advisory_client','advisory_project','advisory_feasibility_study','advisory_financial_model','recovery_asset','recovery_plan','funding_request')),
  name text NOT NULL,
  initial_state text NOT NULL,
  states text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  from_state text NOT NULL,
  to_state text NOT NULL,
  required_role text,
  requires_approval boolean NOT NULL DEFAULT false,
  required_rules jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, from_state, to_state)
);

CREATE TABLE IF NOT EXISTS public.entity_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  current_state text NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_workflows_entity ON public.entity_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_workflows_state ON public.entity_workflows(current_state);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_entity ON public.workflow_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_created_at ON public.workflow_audit_log(created_at DESC);

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_defs_read ON public.workflow_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY workflow_transitions_read ON public.workflow_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY entity_workflows_all ON public.entity_workflows FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());
CREATE POLICY workflow_audit_read ON public.workflow_audit_log FOR SELECT TO authenticated USING (public.is_advisory_user());

-- Trigger: update updated_at
DROP TRIGGER IF EXISTS trg_entity_workflows_updated_at ON public.entity_workflows;
CREATE TRIGGER trg_entity_workflows_updated_at BEFORE UPDATE ON public.entity_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed workflow definitions and transitions
INSERT INTO public.workflow_definitions (entity_type, name, initial_state, states) VALUES
  ('advisory_project', 'Advisory Project Workflow', 'draft', ARRAY['draft','lead','proposal','active','on_hold','completed','cancelled']),
  ('recovery_asset', 'Recovery Asset Workflow', 'identified', ARRAY['identified','valuation','planning','active_rescue','restructuring','recovered','liquidated','write_off']),
  ('funding_request', 'Funding Request Workflow', 'draft', ARRAY['draft','submitted','under_review','approved','rejected','funded'])
ON CONFLICT (entity_type) DO NOTHING;

DO $$
DECLARE v_proj uuid;
DECLARE v_asset uuid;
DECLARE v_fund uuid;
BEGIN
  SELECT id INTO v_proj FROM public.workflow_definitions WHERE entity_type = 'advisory_project';
  SELECT id INTO v_asset FROM public.workflow_definitions WHERE entity_type = 'recovery_asset';
  SELECT id INTO v_fund FROM public.workflow_definitions WHERE entity_type = 'funding_request';

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, required_rules) VALUES
    (v_proj, 'draft', 'lead', '["hasClient"]'),
    (v_proj, 'lead', 'proposal', '["hasClient"]'),
    (v_proj, 'proposal', 'active', '["hasClient","nonEmptyBudget"]'),
    (v_proj, 'active', 'on_hold', '[]'),
    (v_proj, 'active', 'completed', '["requireEndDate"]'),
    (v_proj, 'on_hold', 'active', '[]'),
    (v_proj, 'proposal', 'cancelled', '[]'),
    (v_proj, 'active', 'cancelled', '[]')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, requires_approval, required_rules) VALUES
    (v_asset, 'identified', 'valuation', false, '["hasClient"]'),
    (v_asset, 'valuation', 'planning', false, '["nonEmptyBudget"]'),
    (v_asset, 'planning', 'active_rescue', false, '[]'),
    (v_asset, 'active_rescue', 'restructuring', false, '[]'),
    (v_asset, 'active_rescue', 'recovered', false, '[]'),
    (v_asset, 'restructuring', 'recovered', false, '[]'),
    (v_asset, 'restructuring', 'liquidated', false, '[]'),
    (v_asset, 'active_rescue', 'liquidated', false, '[]'),
    (v_asset, 'planning', 'write_off', true, '[]')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, requires_approval, required_rules) VALUES
    (v_fund, 'draft', 'submitted', false, '["hasClient","nonEmptyBudget"]'),
    (v_fund, 'submitted', 'under_review', false, '[]'),
    (v_fund, 'under_review', 'approved', true, '[]'),
    (v_fund, 'under_review', 'rejected', true, '[]'),
    (v_fund, 'approved', 'funded', false, '[]')
  ON CONFLICT DO NOTHING;
END $$;

-- RPC: validate and perform transition
CREATE OR REPLACE FUNCTION public.workflow_transition(
  p_entity_type text,
  p_entity_id uuid,
  p_to_state text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  v_def public.workflow_definitions%ROWTYPE;
  v_ew public.entity_workflows%ROWTYPE;
  v_t public.workflow_transitions%ROWTYPE;
BEGIN
  SELECT * INTO v_def FROM public.workflow_definitions WHERE entity_type = p_entity_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workflow definition not found');
  END IF;

  SELECT * INTO v_ew FROM public.entity_workflows WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
  IF NOT FOUND THEN
    INSERT INTO public.entity_workflows (entity_type, entity_id, definition_id, current_state)
    VALUES (p_entity_type, p_entity_id, v_def.id, v_def.initial_state)
    RETURNING * INTO v_ew;
  END IF;

  SELECT * INTO v_t
  FROM public.workflow_transitions
  WHERE definition_id = v_def.id AND from_state = v_ew.current_state AND to_state = p_to_state;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', format('Transition %s -> %s is not allowed', v_ew.current_state, p_to_state));
  END IF;

  IF v_t.requires_approval AND (p_context->>'approvedBy') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval required');
  END IF;

  UPDATE public.entity_workflows SET current_state = p_to_state, updated_at = now()
  WHERE id = v_ew.id;

  INSERT INTO public.workflow_audit_log (entity_type, entity_id, from_state, to_state, actor_id, reason, metadata)
  VALUES (p_entity_type, p_entity_id, v_ew.current_state, p_to_state, p_actor_id, p_reason, p_context);

  RETURN jsonb_build_object('success', true, 'from_state', v_ew.current_state, 'to_state', p_to_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get allowed next states
CREATE OR REPLACE FUNCTION public.workflow_allowed_states(p_entity_type text, p_entity_id uuid)
RETURNS TABLE(to_state text, requires_approval boolean) AS $$
DECLARE v_def_id uuid;
DECLARE v_current text;
BEGIN
  SELECT definition_id, current_state INTO v_def_id, v_current
  FROM public.entity_workflows WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
  IF v_def_id IS NULL THEN
    SELECT id INTO v_def_id FROM public.workflow_definitions WHERE entity_type = p_entity_type;
    SELECT initial_state INTO v_current FROM public.workflow_definitions WHERE id = v_def_id;
  END IF;
  RETURN QUERY
  SELECT t.to_state, t.requires_approval
  FROM public.workflow_transitions t
  WHERE t.definition_id = v_def_id AND t.from_state = v_current;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Enterprise Data Quality Center
-- Tables and functions to detect duplicates, missing data, broken relationships.

CREATE TABLE IF NOT EXISTS public.data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL CHECK (check_type IN ('duplicate','missing','broken_relation','orphan_file','incomplete','invalid')),
  entity_type text NOT NULL,
  entity_id uuid,
  field_name text,
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_quality_type ON public.data_quality_issues(check_type);
CREATE INDEX IF NOT EXISTS idx_data_quality_entity ON public.data_quality_issues(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_status ON public.data_quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_data_quality_severity ON public.data_quality_issues(severity);

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_quality_all ON public.data_quality_issues FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Helper: clear existing open issues before re-running checks
CREATE OR REPLACE FUNCTION public.clear_data_quality_issues(p_check_type text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF p_check_type IS NULL THEN
    DELETE FROM public.data_quality_issues WHERE status = 'open';
  ELSE
    DELETE FROM public.data_quality_issues WHERE status = 'open' AND check_type = p_check_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check duplicate advisory clients by email
CREATE OR REPLACE FUNCTION public.dq_find_duplicate_clients()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message, metadata)
  SELECT 'duplicate', 'advisory_client', c1.id, 'email', 'high',
         'عميل مكرر بنفس البريد الإلكتروني: ' || c1.email,
         jsonb_build_object('email', c1.email, 'duplicate_ids', array_agg(c2.id))
  FROM public.advisory_clients c1
  JOIN public.advisory_clients c2 ON lower(trim(c1.email)) = lower(trim(c2.email)) AND c1.id < c2.id
  WHERE c1.email IS NOT NULL AND length(trim(c1.email)) > 0
  GROUP BY c1.id, c1.email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check missing required fields
CREATE OR REPLACE FUNCTION public.dq_find_missing_fields()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_client', id, 'name', 'critical', 'اسم العميل ناقص'
  FROM public.advisory_clients WHERE name IS NULL OR length(trim(name)) = 0;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_project', id, 'client_id', 'critical', 'المشروع غير مرتبط بعميل'
  FROM public.advisory_projects WHERE client_id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_project', id, 'budget', 'medium', 'المشروع لا يحتوي على ميزانية'
  FROM public.advisory_projects WHERE budget IS NULL OR budget <= 0;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'recovery_asset', id, 'original_value', 'medium', 'الأصل لا يحتوي على قيمة أصلية'
  FROM public.recovery_assets WHERE original_value IS NULL OR original_value <= 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check broken relations
CREATE OR REPLACE FUNCTION public.dq_find_broken_relations()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_project', p.id, 'client_id', 'critical', 'المشروع مرتبط بعميل غير موجود'
  FROM public.advisory_projects p
  LEFT JOIN public.advisory_clients c ON c.id = p.client_id
  WHERE p.client_id IS NOT NULL AND c.id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_feasibility_study', s.id, 'client_id', 'critical', 'دراسة الجدوى مرتبطة بعميل غير موجود'
  FROM public.advisory_feasibility_studies s
  LEFT JOIN public.advisory_clients c ON c.id = s.client_id
  WHERE s.client_id IS NOT NULL AND c.id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_feasibility_study', s.id, 'project_id', 'high', 'دراسة الجدوى مرتبطة بمشروع غير موجود'
  FROM public.advisory_feasibility_studies s
  LEFT JOIN public.advisory_projects p ON p.id = s.project_id
  WHERE s.project_id IS NOT NULL AND p.id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check incomplete projects
CREATE OR REPLACE FUNCTION public.dq_find_incomplete_projects()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message, metadata)
  SELECT 'incomplete', 'advisory_project', id, 'status', 'medium',
         'مشروع نشط بدون تاريخ انتهاء أو ميزانية',
         jsonb_build_object('status', status, 'budget', budget, 'end_date', end_date)
  FROM public.advisory_projects
  WHERE status = 'active' AND (end_date IS NULL OR budget IS NULL OR budget <= 0);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master check runner
CREATE OR REPLACE FUNCTION public.dq_run_all_checks()
RETURNS jsonb AS $$
DECLARE v_dup bigint;
DECLARE v_miss bigint;
DECLARE v_broken bigint;
DECLARE v_incomp bigint;
BEGIN
  PERFORM public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  RETURN jsonb_build_object(
    'success', true,
    'duplicates', v_dup,
    'missing', v_miss,
    'broken_relations', v_broken,
    'incomplete', v_incomp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Enterprise Soft Deletes & Data Quality Fixes

-- Add deleted_at to transactional tables
ALTER TABLE public.advisory_clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.advisory_projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.recovery_assets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add updated_by audit columns
ALTER TABLE public.advisory_clients ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advisory_projects ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.recovery_assets ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ai_advisor_reports ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set default updated_at triggers where missing
DROP TRIGGER IF EXISTS trg_recovery_assets_updated_at ON public.recovery_assets;
CREATE TRIGGER trg_recovery_assets_updated_at BEFORE UPDATE ON public.recovery_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_advisor_reports_updated_by_updated_at ON public.ai_advisor_reports;
CREATE TRIGGER trg_ai_advisor_reports_updated_by_updated_at BEFORE UPDATE ON public.ai_advisor_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalize empty emails to NULL so unique constraint allows multiple unknowns
UPDATE public.advisory_clients SET email = NULL WHERE email IS NOT NULL AND length(trim(email)) = 0;

-- Fix duplicate emails before adding unique constraint (keep oldest record)
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT lower(trim(email)) AS email_lower
    FROM public.advisory_clients
    WHERE email IS NOT NULL AND length(trim(email)) > 0
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  LOOP
    -- Mark newer duplicates with a suffix so unique constraint can be added later
    UPDATE public.advisory_clients c1
    SET email = c1.email || '.dup.' || substr(md5(random()::text), 1, 6)
    FROM (
      SELECT id, row_number() OVER (PARTITION BY lower(trim(email)) ORDER BY created_at, id) AS rn
      FROM public.advisory_clients
      WHERE lower(trim(email)) = rec.email_lower
    ) c2
    WHERE c1.id = c2.id AND c2.rn > 1;
  END LOOP;
END $$;

-- Add unique constraints where safe
ALTER TABLE public.advisory_clients ADD CONSTRAINT uq_advisory_clients_email UNIQUE (email);

-- Add FK from profiles to auth.users
DO $$
BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;
-- AI Business Advisor — Saved executive reports
-- Stores generated management reports for audit and sharing.

CREATE TABLE IF NOT EXISTS public.ai_advisor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content_html text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_advisor_reports IS 'Saved executive reports generated by the AI Business Advisor module.';

CREATE INDEX IF NOT EXISTS idx_ai_advisor_reports_created_by ON public.ai_advisor_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_advisor_reports_created_at ON public.ai_advisor_reports(created_at DESC);

ALTER TABLE public.ai_advisor_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_advisor_reports_select ON public.ai_advisor_reports;
CREATE POLICY ai_advisor_reports_select ON public.ai_advisor_reports FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS ai_advisor_reports_insert ON public.ai_advisor_reports;
CREATE POLICY ai_advisor_reports_insert ON public.ai_advisor_reports FOR INSERT TO authenticated WITH CHECK (public.is_advisory_user() AND auth.uid() = created_by);

DROP POLICY IF EXISTS ai_advisor_reports_update ON public.ai_advisor_reports;
CREATE POLICY ai_advisor_reports_update ON public.ai_advisor_reports FOR UPDATE TO authenticated USING (public.is_advisory_user() AND auth.uid() = created_by) WITH CHECK (public.is_advisory_user() AND auth.uid() = created_by);

DROP POLICY IF EXISTS ai_advisor_reports_delete ON public.ai_advisor_reports;
CREATE POLICY ai_advisor_reports_delete ON public.ai_advisor_reports FOR DELETE TO authenticated USING (public.is_advisory_user() AND auth.uid() = created_by);

DROP TRIGGER IF EXISTS trg_ai_advisor_reports_updated_at ON public.ai_advisor_reports;
CREATE TRIGGER trg_ai_advisor_reports_updated_at BEFORE UPDATE ON public.ai_advisor_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Enterprise Global Search
-- Materialized view across clients, projects, assets, studies, reports.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.global_search_index AS
SELECT
  'advisory_client'::text AS entity_type,
  c.id AS entity_id,
  c.name AS title,
  coalesce(c.email, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.phone, '') AS content,
  c.created_at
FROM public.advisory_clients c
WHERE c.deleted_at IS NULL
UNION ALL
SELECT
  'advisory_project'::text,
  p.id,
  p.name,
  coalesce(c.name, '') || ' ' || coalesce(p.description, '') || ' ' || p.status,
  p.created_at
FROM public.advisory_projects p
LEFT JOIN public.advisory_clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
UNION ALL
SELECT
  'recovery_asset'::text,
  r.id,
  r.name,
  coalesce(r.category, '') || ' ' || coalesce(r.status, '') || ' ' || coalesce(r.priority, ''),
  r.created_at
FROM public.recovery_assets r
WHERE r.deleted_at IS NULL
UNION ALL
SELECT
  'advisory_feasibility_study'::text,
  s.id,
  s.title,
  coalesce(c.name, '') || ' ' || coalesce(s.sector, '') || ' ' || coalesce(s.country, '') || ' ' || s.status,
  s.created_at
FROM public.advisory_feasibility_studies s
LEFT JOIN public.advisory_clients c ON c.id = s.client_id
UNION ALL
SELECT
  'ai_advisor_report'::text,
  rep.id,
  rep.title,
  coalesce(rep.summary->>'health_label', '') || ' ' || coalesce(rep.summary->>'risk_level', ''),
  rep.created_at
FROM public.ai_advisor_reports rep;

CREATE INDEX IF NOT EXISTS idx_global_search_title_trgm ON public.global_search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_content_trgm ON public.global_search_index USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_entity ON public.global_search_index(entity_type, entity_id);

-- RPC: fuzzy ranked search
CREATE OR REPLACE FUNCTION public.global_search(p_query text, p_limit int DEFAULT 20, p_entity_types text[] DEFAULT NULL)
RETURNS TABLE(entity_type text, entity_id uuid, title text, content text, rank real) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.entity_type,
    g.entity_id,
    g.title,
    g.content,
    (
      similarity(lower(g.title), lower(p_query)) * 2.0 +
      similarity(lower(g.content), lower(p_query)) * 1.0
    )::real AS rank
  FROM public.global_search_index g
  WHERE
    (p_entity_types IS NULL OR g.entity_type = ANY(p_entity_types))
    AND (
      lower(g.title) % lower(p_query)
      OR lower(g.content) % lower(p_query)
      OR g.title ILIKE '%' || p_query || '%'
      OR g.content ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh index
CREATE OR REPLACE FUNCTION public.refresh_global_search_index()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.global_search_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Enterprise Monitoring, Logging & Error Tracking

CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('debug','info','warning','error','critical')),
  component text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  url text,
  user_agent text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  message text NOT NULL,
  stack text,
  metadata jsonb NOT NULL DEFAULT '{}',
  url text,
  user_agent text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON public.error_logs(component);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_logs_admin ON public.system_logs FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());
CREATE POLICY error_logs_admin ON public.error_logs FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Helper: log from SQL
CREATE OR REPLACE FUNCTION public.log_system(p_level text, p_component text, p_message text, p_metadata jsonb DEFAULT '{}')
RETURNS void AS $$
BEGIN
  INSERT INTO public.system_logs (level, component, message, metadata)
  VALUES (p_level, p_component, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: partition high-volume tables by month ( declarative partitioning for new tables)
-- Note: migrating existing page_views/usage_logs to partitioned tables is a future manual task.
-- Enterprise Performance Indexes & Cleanup

-- Remove duplicate indexes
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_sub;
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_subscription_id;

-- Add missing reporting indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_start ON public.subscriptions(current_period_start);
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_paid_at ON public.moyasar_invoices(paid_at);
CREATE INDEX IF NOT EXISTS idx_advisory_projects_created_at ON public.advisory_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_created_at ON public.recovery_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_created_at ON public.bank_transfer_requests(created_at DESC);

-- Composite indexes for common admin filters
CREATE INDEX IF NOT EXISTS idx_advisory_projects_status_created ON public.advisory_projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisory_clients_status_created ON public.advisory_clients(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_status_created ON public.recovery_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_advisor_reports_status_created ON public.ai_advisor_reports(created_by, created_at DESC);

-- Lower-case email indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_advisory_clients_email_lower ON public.advisory_clients(lower(email));
-- Enterprise Security Hardening: RLS and audit policies

-- Helper: user owns the record or is manager/admin
CREATE OR REPLACE FUNCTION public.is_owner_or_manager(p_owner_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN p_owner_id = auth.uid() OR public.is_advisory_manager();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tighten advisory clients: users see only assigned/created records unless manager
DROP POLICY IF EXISTS advisory_clients_select ON public.advisory_clients;
CREATE POLICY advisory_clients_select ON public.advisory_clients FOR SELECT TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR deleted_at IS NULL
  );

DROP POLICY IF EXISTS advisory_clients_modify ON public.advisory_clients;
CREATE POLICY advisory_clients_modify ON public.advisory_clients FOR ALL TO authenticated
  USING (public.is_advisory_manager() OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.is_advisory_manager() OR assigned_to = auth.uid() OR created_by = auth.uid());

-- Tighten advisory projects
DROP POLICY IF EXISTS advisory_projects_select ON public.advisory_projects;
CREATE POLICY advisory_projects_select ON public.advisory_projects FOR SELECT TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS advisory_projects_modify ON public.advisory_projects;
CREATE POLICY advisory_projects_modify ON public.advisory_projects FOR ALL TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- Recovery assets ownership
DROP POLICY IF EXISTS recovery_assets_select ON public.recovery_assets;
CREATE POLICY recovery_assets_select ON public.recovery_assets FOR SELECT TO authenticated
  USING (public.is_advisory_manager() OR created_by = auth.uid());

DROP POLICY IF EXISTS recovery_assets_modify ON public.recovery_assets;
CREATE POLICY recovery_assets_modify ON public.recovery_assets FOR ALL TO authenticated
  USING (public.is_advisory_manager() OR created_by = auth.uid())
  WITH CHECK (public.is_advisory_manager() OR created_by = auth.uid());

-- Prevent access to soft-deleted records for non-managers
ALTER POLICY advisory_clients_select ON public.advisory_clients USING (
  public.is_advisory_manager()
  OR (
    deleted_at IS NULL
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  )
);

ALTER POLICY advisory_projects_select ON public.advisory_projects USING (
  public.is_advisory_manager()
  OR (
    deleted_at IS NULL
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.advisory_clients c
        WHERE c.id = advisory_projects.client_id
          AND c.deleted_at IS NULL
          AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
      )
    )
  )
);
