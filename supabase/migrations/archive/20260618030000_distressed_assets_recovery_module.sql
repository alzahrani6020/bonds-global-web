-- Distressed Assets Recovery Module Schema

-- =====================================================
-- Roles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('advisor','manager','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

COMMENT ON TABLE public.recovery_roles IS 'Access roles for the distressed assets recovery module.';

-- =====================================================
-- Distressed Assets
-- =====================================================
CREATE TABLE IF NOT EXISTS public.distressed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'company' CHECK (asset_type IN ('real_estate','equipment','company','bond','project','other')),
  owner_name text,
  owner_email text,
  owner_phone text,
  location text,
  country text,
  city text,
  acquisition_cost numeric(15,2),
  market_value numeric(15,2),
  distressed_value numeric(15,2),
  evaluation_date date,
  distress_score integer CHECK (distress_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','evaluating','rescuing','recovered','liquidated')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distressed_assets_status ON public.distressed_assets(status);
CREATE INDEX IF NOT EXISTS idx_distressed_assets_assigned_to ON public.distressed_assets(assigned_to);

-- =====================================================
-- Distress Reasons
-- =====================================================
CREATE TABLE IF NOT EXISTS public.distress_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.distressed_assets(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('financial','operational','market','legal','management','external')),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distress_reasons_asset_id ON public.distress_reasons(asset_id);

-- =====================================================
-- Recovery Plans
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.distressed_assets(id) ON DELETE CASCADE,
  strategy text NOT NULL CHECK (strategy IN ('restructure','refinance','sale','merger','liquidation','other')),
  summary text,
  expected_recovery_value numeric(15,2),
  timeline_months integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','completed','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_plans_asset_id ON public.recovery_plans(asset_id);

-- =====================================================
-- Recovery Phases
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.distressed_assets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','skipped')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_phases_plan_id ON public.recovery_phases(plan_id);
CREATE INDEX IF NOT EXISTS idx_recovery_phases_asset_id ON public.recovery_phases(asset_id);

-- =====================================================
-- Recovery Costs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.distressed_assets(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.recovery_phases(id) ON DELETE SET NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('legal','advisory','marketing','operational','acquisition','other')),
  amount numeric(15,2) NOT NULL,
  description text,
  cost_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_costs_asset_id ON public.recovery_costs(asset_id);

-- =====================================================
-- Recovery Investors
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.distressed_assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  investor_type text NOT NULL DEFAULT 'company' CHECK (investor_type IN ('individual','fund','bank','company','other')),
  interest_level text NOT NULL DEFAULT 'medium' CHECK (interest_level IN ('low','medium','high')),
  offered_amount numeric(15,2),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_investors_asset_id ON public.recovery_investors(asset_id);

-- =====================================================
-- Documents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('asset','plan','phase','investor')),
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_documents_entity ON public.recovery_documents(entity_type, entity_id);

-- =====================================================
-- Notes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('asset','plan','phase','investor')),
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_notes_entity ON public.recovery_notes(entity_type, entity_id);

-- =====================================================
-- Activity Log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recovery_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('asset','reason','plan','phase','cost','investor','document','note')),
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_logs_entity ON public.recovery_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recovery_logs_created_at ON public.recovery_activity_logs(created_at DESC);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.recovery_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distressed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distress_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_recovery_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_recovery_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles WHERE user_id = auth.uid() AND role = 'manager'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Roles policies
DROP POLICY IF EXISTS recovery_roles_select ON public.recovery_roles;
CREATE POLICY recovery_roles_select ON public.recovery_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS recovery_roles_manage ON public.recovery_roles;
CREATE POLICY recovery_roles_manage ON public.recovery_roles FOR ALL TO authenticated USING (public.is_recovery_manager()) WITH CHECK (public.is_recovery_manager());

-- Assets policies
DROP POLICY IF EXISTS distressed_assets_select ON public.distressed_assets;
CREATE POLICY distressed_assets_select ON public.distressed_assets FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS distressed_assets_modify ON public.distressed_assets;
CREATE POLICY distressed_assets_modify ON public.distressed_assets FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Reasons policies
DROP POLICY IF EXISTS distress_reasons_select ON public.distress_reasons;
CREATE POLICY distress_reasons_select ON public.distress_reasons FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS distress_reasons_modify ON public.distress_reasons;
CREATE POLICY distress_reasons_modify ON public.distress_reasons FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Plans policies
DROP POLICY IF EXISTS recovery_plans_select ON public.recovery_plans;
CREATE POLICY recovery_plans_select ON public.recovery_plans FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_plans_modify ON public.recovery_plans;
CREATE POLICY recovery_plans_modify ON public.recovery_plans FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Phases policies
DROP POLICY IF EXISTS recovery_phases_select ON public.recovery_phases;
CREATE POLICY recovery_phases_select ON public.recovery_phases FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_phases_modify ON public.recovery_phases;
CREATE POLICY recovery_phases_modify ON public.recovery_phases FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Costs policies
DROP POLICY IF EXISTS recovery_costs_select ON public.recovery_costs;
CREATE POLICY recovery_costs_select ON public.recovery_costs FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_costs_modify ON public.recovery_costs;
CREATE POLICY recovery_costs_modify ON public.recovery_costs FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Investors policies
DROP POLICY IF EXISTS recovery_investors_select ON public.recovery_investors;
CREATE POLICY recovery_investors_select ON public.recovery_investors FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_investors_modify ON public.recovery_investors;
CREATE POLICY recovery_investors_modify ON public.recovery_investors FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Documents policies
DROP POLICY IF EXISTS recovery_documents_select ON public.recovery_documents;
CREATE POLICY recovery_documents_select ON public.recovery_documents FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_documents_modify ON public.recovery_documents;
CREATE POLICY recovery_documents_modify ON public.recovery_documents FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Notes policies
DROP POLICY IF EXISTS recovery_notes_select ON public.recovery_notes;
CREATE POLICY recovery_notes_select ON public.recovery_notes FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_notes_modify ON public.recovery_notes;
CREATE POLICY recovery_notes_modify ON public.recovery_notes FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());

-- Logs policies
DROP POLICY IF EXISTS recovery_logs_select ON public.recovery_activity_logs;
CREATE POLICY recovery_logs_select ON public.recovery_activity_logs FOR SELECT TO authenticated USING (public.is_recovery_user());

DROP POLICY IF EXISTS recovery_logs_insert ON public.recovery_activity_logs;
CREATE POLICY recovery_logs_insert ON public.recovery_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- =====================================================
-- Updated at triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_distressed_assets_updated_at ON public.distressed_assets;
CREATE TRIGGER trg_distressed_assets_updated_at BEFORE UPDATE ON public.distressed_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_plans_updated_at ON public.recovery_plans;
CREATE TRIGGER trg_recovery_plans_updated_at BEFORE UPDATE ON public.recovery_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_phases_updated_at ON public.recovery_phases;
CREATE TRIGGER trg_recovery_phases_updated_at BEFORE UPDATE ON public.recovery_phases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_notes_updated_at ON public.recovery_notes;
CREATE TRIGGER trg_recovery_notes_updated_at BEFORE UPDATE ON public.recovery_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Storage bucket for documents
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recovery-documents', 'recovery-documents', false, 20971520, null)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS recovery_storage_select ON storage.objects;
CREATE POLICY recovery_storage_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'recovery-documents');

DROP POLICY IF EXISTS recovery_storage_insert ON storage.objects;
CREATE POLICY recovery_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'recovery-documents');

DROP POLICY IF EXISTS recovery_storage_delete ON storage.objects;
CREATE POLICY recovery_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'recovery-documents');
