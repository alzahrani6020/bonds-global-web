-- Financial Advisory Module Schema
-- Clients, projects, feasibility studies, financial models, documents, notes, activity logs.

-- =====================================================
-- Roles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('advisor','manager','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

COMMENT ON TABLE public.advisory_roles IS 'Access roles for the financial advisory module.';

-- =====================================================
-- Clients
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  country text,
  city text,
  sector text,
  company_name text,
  tax_number text,
  address text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_clients_status ON public.advisory_clients(status);
CREATE INDEX IF NOT EXISTS idx_advisory_clients_assigned_to ON public.advisory_clients(assigned_to);

-- =====================================================
-- Projects
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.advisory_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','on_hold','completed','cancelled')),
  start_date date,
  end_date date,
  budget numeric(15,2),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_projects_client_id ON public.advisory_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_advisory_projects_status ON public.advisory_projects(status);

-- =====================================================
-- Feasibility Studies
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_feasibility_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.advisory_projects(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.advisory_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  sector text,
  country text,
  assumptions jsonb NOT NULL DEFAULT '{}',
  financials jsonb NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_feasibility_client_id ON public.advisory_feasibility_studies(client_id);
CREATE INDEX IF NOT EXISTS idx_advisory_feasibility_project_id ON public.advisory_feasibility_studies(project_id);
CREATE INDEX IF NOT EXISTS idx_advisory_feasibility_status ON public.advisory_feasibility_studies(status);

-- =====================================================
-- Financial Models
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_financial_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.advisory_projects(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.advisory_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  model_type text NOT NULL DEFAULT 'valuation' CHECK (model_type IN ('valuation','dcf','budget','projection','custom')),
  assumptions jsonb NOT NULL DEFAULT '{}',
  projections jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_models_client_id ON public.advisory_financial_models(client_id);
CREATE INDEX IF NOT EXISTS idx_advisory_models_project_id ON public.advisory_financial_models(project_id);

-- =====================================================
-- Documents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client','project','study','model')),
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_documents_entity ON public.advisory_documents(entity_type, entity_id);

-- =====================================================
-- Notes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client','project','study','model')),
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_notes_entity ON public.advisory_notes(entity_type, entity_id);

-- =====================================================
-- Activity Log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.advisory_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client','project','study','model','document','note','user')),
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_logs_entity ON public.advisory_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_advisory_logs_created_at ON public.advisory_activity_logs(created_at DESC);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.advisory_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_feasibility_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_financial_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper: current user has advisory access
CREATE OR REPLACE FUNCTION public.is_advisory_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advisory_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_advisory_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advisory_roles WHERE user_id = auth.uid() AND role = 'manager'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Roles policies
DROP POLICY IF EXISTS advisory_roles_select ON public.advisory_roles;
CREATE POLICY advisory_roles_select ON public.advisory_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS advisory_roles_manage ON public.advisory_roles;
CREATE POLICY advisory_roles_manage ON public.advisory_roles FOR ALL TO authenticated USING (public.is_advisory_manager()) WITH CHECK (public.is_advisory_manager());

-- Clients policies
DROP POLICY IF EXISTS advisory_clients_select ON public.advisory_clients;
CREATE POLICY advisory_clients_select ON public.advisory_clients FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_clients_modify ON public.advisory_clients;
CREATE POLICY advisory_clients_modify ON public.advisory_clients FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Projects policies
DROP POLICY IF EXISTS advisory_projects_select ON public.advisory_projects;
CREATE POLICY advisory_projects_select ON public.advisory_projects FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_projects_modify ON public.advisory_projects;
CREATE POLICY advisory_projects_modify ON public.advisory_projects FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Studies policies
DROP POLICY IF EXISTS advisory_studies_select ON public.advisory_feasibility_studies;
CREATE POLICY advisory_studies_select ON public.advisory_feasibility_studies FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_studies_modify ON public.advisory_feasibility_studies;
CREATE POLICY advisory_studies_modify ON public.advisory_feasibility_studies FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Models policies
DROP POLICY IF EXISTS advisory_models_select ON public.advisory_financial_models;
CREATE POLICY advisory_models_select ON public.advisory_financial_models FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_models_modify ON public.advisory_models;
CREATE POLICY advisory_models_modify ON public.advisory_financial_models FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Documents policies
DROP POLICY IF EXISTS advisory_documents_select ON public.advisory_documents;
CREATE POLICY advisory_documents_select ON public.advisory_documents FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_documents_modify ON public.advisory_documents;
CREATE POLICY advisory_documents_modify ON public.advisory_documents FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Notes policies
DROP POLICY IF EXISTS advisory_notes_select ON public.advisory_notes;
CREATE POLICY advisory_notes_select ON public.advisory_notes FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_notes_modify ON public.advisory_notes;
CREATE POLICY advisory_notes_modify ON public.advisory_notes FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Activity logs policies
DROP POLICY IF EXISTS advisory_logs_select ON public.advisory_activity_logs;
CREATE POLICY advisory_logs_select ON public.advisory_activity_logs FOR SELECT TO authenticated USING (public.is_advisory_user());

DROP POLICY IF EXISTS advisory_logs_insert ON public.advisory_activity_logs;
CREATE POLICY advisory_logs_insert ON public.advisory_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- =====================================================
-- Updated at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_advisory_clients_updated_at ON public.advisory_clients;
CREATE TRIGGER trg_advisory_clients_updated_at BEFORE UPDATE ON public.advisory_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_advisory_projects_updated_at ON public.advisory_projects;
CREATE TRIGGER trg_advisory_projects_updated_at BEFORE UPDATE ON public.advisory_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_advisory_feasibility_updated_at ON public.advisory_feasibility_studies;
CREATE TRIGGER trg_advisory_feasibility_updated_at BEFORE UPDATE ON public.advisory_feasibility_studies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_advisory_models_updated_at ON public.advisory_financial_models;
CREATE TRIGGER trg_advisory_models_updated_at BEFORE UPDATE ON public.advisory_financial_models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_advisory_notes_updated_at ON public.advisory_notes;
CREATE TRIGGER trg_advisory_notes_updated_at BEFORE UPDATE ON public.advisory_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Storage bucket for documents
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('advisory-documents', 'advisory-documents', false, 20971520, null)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS advisory_storage_select ON storage.objects;
CREATE POLICY advisory_storage_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'advisory-documents');

DROP POLICY IF EXISTS advisory_storage_insert ON storage.objects;
CREATE POLICY advisory_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'advisory-documents');

DROP POLICY IF EXISTS advisory_storage_delete ON storage.objects;
CREATE POLICY advisory_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'advisory-documents');
-- Migration: Distressed Assets Recovery Module
-- Created: 2026-06-18

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles table for recovery module access
CREATE TABLE IF NOT EXISTS public.recovery_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','manager','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.recovery_roles IS 'Access control for distressed assets recovery module';

-- Distressed assets
CREATE TABLE IF NOT EXISTS public.recovery_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('real_estate','equipment','vehicle','inventory','receivable','investment','other')),
  description text,
  owner_name text,
  owner_contact text,
  country_code text,
  city text,
  original_value numeric(15,2) NOT NULL DEFAULT 0,
  distressed_value numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','valuation','planning','active_rescue','restructuring','recovered','liquidated','write_off')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  acquisition_date date,
  distress_date date,
  assigned_manager uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[],
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recovery_assets IS 'Distressed assets registered for rescue';

-- Asset valuations history
CREATE TABLE IF NOT EXISTS public.recovery_asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  market_value numeric(15,2) NOT NULL DEFAULT 0,
  forced_sale_value numeric(15,2),
  recovery_value numeric(15,2),
  method text,
  appraiser text,
  notes text,
  documents jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Distress reasons
CREATE TABLE IF NOT EXISTS public.recovery_distress_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  reason_category text NOT NULL CHECK (reason_category IN ('market_decline','cash_flow','operational','legal','fraud','natural_disaster','macro','other')),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  discovered_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rescue plans
CREATE TABLE IF NOT EXISTS public.recovery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  strategy text NOT NULL CHECK (strategy IN ('restructure','refinance','sell','lease','operational_turnaround','legal_action','liquidation','write_off')),
  summary text,
  expected_recovery_value numeric(15,2) NOT NULL DEFAULT 0,
  expected_recovery_date date,
  probability numeric(5,2) CHECK (probability BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','completed','cancelled')),
  assigned_team jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Plan stages
CREATE TABLE IF NOT EXISTS public.recovery_plan_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
  stage_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked','skipped')),
  due_date date,
  completed_at timestamptz,
  owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rescue costs
CREATE TABLE IF NOT EXISTS public.recovery_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE SET NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('legal','admin','marketing','repair','appraisal','consulting','holding','other')),
  amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  incurred_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  receipt_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Investors / buyers
CREATE TABLE IF NOT EXISTS public.recovery_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('individual','company','fund','bank','government','other')),
  contact_name text,
  email text,
  phone text,
  country_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Investor offers linked to assets/plans
CREATE TABLE IF NOT EXISTS public.recovery_investor_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES public.recovery_investors(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE SET NULL,
  offer_value numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  offer_type text NOT NULL DEFAULT 'purchase' CHECK (offer_type IN ('purchase','partnership','refinance','lease')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','under_review','accepted','rejected','negotiating')),
  submitted_at date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS public.recovery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  file_size int,
  storage_path text NOT NULL,
  public_url text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notes
CREATE TABLE IF NOT EXISTS public.recovery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS public.recovery_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_assets_status ON public.recovery_assets(status);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_priority ON public.recovery_assets(priority);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_category ON public.recovery_assets(category);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_country ON public.recovery_assets(country_code);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_asset_id ON public.recovery_plans(asset_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_status ON public.recovery_plans(status);
CREATE INDEX IF NOT EXISTS idx_recovery_costs_asset_id ON public.recovery_costs(asset_id);
CREATE INDEX IF NOT EXISTS idx_recovery_offers_asset_id ON public.recovery_investor_offers(asset_id);
CREATE INDEX IF NOT EXISTS idx_recovery_activity_created_at ON public.recovery_activity_logs(created_at DESC);

-- Updated at triggers
CREATE OR REPLACE FUNCTION public.recovery_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recovery_assets_updated_at ON public.recovery_assets;
CREATE TRIGGER trg_recovery_assets_updated_at
  BEFORE UPDATE ON public.recovery_assets
  FOR EACH ROW EXECUTE FUNCTION public.recovery_set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_plans_updated_at ON public.recovery_plans;
CREATE TRIGGER trg_recovery_plans_updated_at
  BEFORE UPDATE ON public.recovery_plans
  FOR EACH ROW EXECUTE FUNCTION public.recovery_set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_investors_updated_at ON public.recovery_investors;
CREATE TRIGGER trg_recovery_investors_updated_at
  BEFORE UPDATE ON public.recovery_investors
  FOR EACH ROW EXECUTE FUNCTION public.recovery_set_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_investor_offers_updated_at ON public.recovery_investor_offers;
CREATE TRIGGER trg_recovery_investor_offers_updated_at
  BEFORE UPDATE ON public.recovery_investor_offers
  FOR EACH ROW EXECUTE FUNCTION public.recovery_set_updated_at();

-- Enable RLS
ALTER TABLE public.recovery_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_asset_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_distress_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plan_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_investor_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_activity_logs ENABLE ROW LEVEL SECURITY;

-- Role helper
CREATE OR REPLACE FUNCTION public.recovery_is_manager_or_admin(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles
    WHERE recovery_roles.user_id = user_uuid
      AND recovery_roles.role IN ('admin','manager')
  ) OR (
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'admin_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = user_uuid
        AND admin_roles.role IN ('super_admin','admin')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
-- recovery_roles
DROP POLICY IF EXISTS "recovery_roles_select" ON public.recovery_roles;
CREATE POLICY "recovery_roles_select" ON public.recovery_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR role = 'admin');

DROP POLICY IF EXISTS "recovery_roles_admin_write" ON public.recovery_roles;
CREATE POLICY "recovery_roles_admin_write" ON public.recovery_roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recovery_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.recovery_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- recovery_assets
DROP POLICY IF EXISTS "recovery_assets_select" ON public.recovery_assets;
CREATE POLICY "recovery_assets_select" ON public.recovery_assets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_assets_write" ON public.recovery_assets;
CREATE POLICY "recovery_assets_write" ON public.recovery_assets
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_asset_valuations
DROP POLICY IF EXISTS "recovery_valuations_select" ON public.recovery_asset_valuations;
CREATE POLICY "recovery_valuations_select" ON public.recovery_asset_valuations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_valuations_write" ON public.recovery_asset_valuations;
CREATE POLICY "recovery_valuations_write" ON public.recovery_asset_valuations
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_distress_reasons
DROP POLICY IF EXISTS "recovery_reasons_select" ON public.recovery_distress_reasons;
CREATE POLICY "recovery_reasons_select" ON public.recovery_distress_reasons
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_reasons_write" ON public.recovery_distress_reasons;
CREATE POLICY "recovery_reasons_write" ON public.recovery_distress_reasons
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_plans
DROP POLICY IF EXISTS "recovery_plans_select" ON public.recovery_plans;
CREATE POLICY "recovery_plans_select" ON public.recovery_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_plans_write" ON public.recovery_plans;
CREATE POLICY "recovery_plans_write" ON public.recovery_plans
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_plan_stages
DROP POLICY IF EXISTS "recovery_stages_select" ON public.recovery_plan_stages;
CREATE POLICY "recovery_stages_select" ON public.recovery_plan_stages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_stages_write" ON public.recovery_plan_stages;
CREATE POLICY "recovery_stages_write" ON public.recovery_plan_stages
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_costs
DROP POLICY IF EXISTS "recovery_costs_select" ON public.recovery_costs;
CREATE POLICY "recovery_costs_select" ON public.recovery_costs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_costs_write" ON public.recovery_costs;
CREATE POLICY "recovery_costs_write" ON public.recovery_costs
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_investors
DROP POLICY IF EXISTS "recovery_investors_select" ON public.recovery_investors;
CREATE POLICY "recovery_investors_select" ON public.recovery_investors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_investors_write" ON public.recovery_investors;
CREATE POLICY "recovery_investors_write" ON public.recovery_investors
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_investor_offers
DROP POLICY IF EXISTS "recovery_offers_select" ON public.recovery_investor_offers;
CREATE POLICY "recovery_offers_select" ON public.recovery_investor_offers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_offers_write" ON public.recovery_investor_offers;
CREATE POLICY "recovery_offers_write" ON public.recovery_investor_offers
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_documents
DROP POLICY IF EXISTS "recovery_documents_select" ON public.recovery_documents;
CREATE POLICY "recovery_documents_select" ON public.recovery_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_documents_write" ON public.recovery_documents;
CREATE POLICY "recovery_documents_write" ON public.recovery_documents
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_notes
DROP POLICY IF EXISTS "recovery_notes_select" ON public.recovery_notes;
CREATE POLICY "recovery_notes_select" ON public.recovery_notes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_notes_write" ON public.recovery_notes;
CREATE POLICY "recovery_notes_write" ON public.recovery_notes
  FOR ALL TO authenticated USING (public.recovery_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.recovery_is_manager_or_admin(auth.uid()));

-- recovery_activity_logs
DROP POLICY IF EXISTS "recovery_logs_select" ON public.recovery_activity_logs;
CREATE POLICY "recovery_logs_select" ON public.recovery_activity_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recovery_logs_write" ON public.recovery_activity_logs;
CREATE POLICY "recovery_logs_write" ON public.recovery_activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('recovery-documents', 'recovery-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recovery-documents
DROP POLICY IF EXISTS "recovery_documents_storage_select" ON storage.objects;
CREATE POLICY "recovery_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'recovery-documents');

DROP POLICY IF EXISTS "recovery_documents_storage_insert" ON storage.objects;
CREATE POLICY "recovery_documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'recovery-documents' AND
    public.recovery_is_manager_or_admin(auth.uid())
  );

DROP POLICY IF EXISTS "recovery_documents_storage_delete" ON storage.objects;
CREATE POLICY "recovery_documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'recovery-documents' AND
    public.recovery_is_manager_or_admin(auth.uid())
  );
