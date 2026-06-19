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

DROP POLICY IF EXISTS advisory_models_modify ON public.advisory_financial_models;
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
