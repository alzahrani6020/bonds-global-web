-- Wave 1 — Core Architecture Stabilization
-- Canonical Data Model, Global Object Registry, Business Rules Registry,
-- Formula Registry, Data Source Catalog, Data Override Audit, Audit Logs.
-- Idempotent; safe to run on existing databases.

-- -----------------------------------------------------------------------------
-- 1. Helper trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. Global Object Registry — sequence allocator
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  year integer NOT NULL,
  country_code text,
  last_number bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_sequences IS 'Central sequence allocator for BONDS human-readable IDs.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'bonds_sequences'
      AND indexname = 'bonds_sequences_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX bonds_sequences_unique_idx
      ON public.bonds_sequences (prefix, year, COALESCE(country_code, ''));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_bonds_sequence(
  p_prefix text,
  p_year integer,
  p_country_code text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.bonds_sequences (prefix, year, country_code, last_number)
  VALUES (p_prefix, p_year, p_country_code, 1)
  ON CONFLICT (prefix, year, COALESCE(country_code, ''))
  DO UPDATE SET last_number = public.bonds_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.next_bonds_sequence(text, integer, text) IS
  'Atomically allocates the next human-readable sequence number for a prefix/year/country.';

-- -----------------------------------------------------------------------------
-- 3. Object registry master table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  human_id text NOT NULL UNIQUE,
  entity_type text NOT NULL,
  reference_table text,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_objects IS 'Master registry of every BONDS human-readable ID.';

CREATE INDEX IF NOT EXISTS bonds_objects_reference_idx
  ON public.bonds_objects (reference_table, reference_id);
CREATE INDEX IF NOT EXISTS bonds_objects_entity_type_idx
  ON public.bonds_objects (entity_type);

-- -----------------------------------------------------------------------------
-- 4. Canonical Data Model
-- -----------------------------------------------------------------------------

-- Projects
CREATE TABLE IF NOT EXISTS public.bonds_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  sub_sector text,
  activity text,
  city_id uuid,
  capital numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  annual_profit numeric NOT NULL DEFAULT 0,
  roi_months numeric,
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'ar',
  currency text NOT NULL DEFAULT 'SAR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.bonds_projects IS 'Canonical project record for BONDS valuations, feasibility, and financing.';

CREATE INDEX IF NOT EXISTS bonds_projects_user_id_idx ON public.bonds_projects (user_id);
CREATE INDEX IF NOT EXISTS bonds_projects_status_idx ON public.bonds_projects (status)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS bonds_projects_updated_at ON public.bonds_projects;
CREATE TRIGGER bonds_projects_updated_at
  BEFORE UPDATE ON public.bonds_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assets
CREATE TABLE IF NOT EXISTS public.bonds_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  asset_class text NOT NULL,
  asset_type text,
  location text,
  area numeric,
  price_per_unit numeric,
  market_value numeric,
  condition_score numeric,
  confidence_score numeric NOT NULL DEFAULT 0,
  data_quality_score numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_assets IS 'Canonical asset record referenced by valuations and certificates.';

CREATE INDEX IF NOT EXISTS bonds_assets_project_id_idx ON public.bonds_assets (project_id);
CREATE INDEX IF NOT EXISTS bonds_assets_class_idx ON public.bonds_assets (asset_class);

DROP TRIGGER IF EXISTS bonds_assets_updated_at ON public.bonds_assets;
CREATE TRIGGER bonds_assets_updated_at
  BEFORE UPDATE ON public.bonds_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Valuations
CREATE TABLE IF NOT EXISTS public.bonds_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_number text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.bonds_assets(id) ON DELETE SET NULL,
  method text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  data_quality_score numeric NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_valuations IS 'Canonical valuation result with confidence and data quality scores.';

CREATE INDEX IF NOT EXISTS bonds_valuations_project_id_idx ON public.bonds_valuations (project_id);
CREATE INDEX IF NOT EXISTS bonds_valuations_asset_id_idx ON public.bonds_valuations (asset_id);
CREATE INDEX IF NOT EXISTS bonds_valuations_status_idx ON public.bonds_valuations (status);

DROP TRIGGER IF EXISTS bonds_valuations_updated_at ON public.bonds_valuations;
CREATE TRIGGER bonds_valuations_updated_at
  BEFORE UPDATE ON public.bonds_valuations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Financing
CREATE TABLE IF NOT EXISTS public.bonds_financing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financing_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  tenor numeric NOT NULL DEFAULT 0,
  dscr numeric,
  monthly_installment numeric,
  risk_grade text,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_financing IS 'Canonical financing structure for a project.';

CREATE INDEX IF NOT EXISTS bonds_financing_project_id_idx ON public.bonds_financing (project_id);
CREATE INDEX IF NOT EXISTS bonds_financing_status_idx ON public.bonds_financing (status);

DROP TRIGGER IF EXISTS bonds_financing_updated_at ON public.bonds_financing;
CREATE TRIGGER bonds_financing_updated_at
  BEFORE UPDATE ON public.bonds_financing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reports
CREATE TABLE IF NOT EXISTS public.bonds_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  evidence_bundle_id uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_reports IS 'Canonical report record linked to evidence bundles.';

CREATE INDEX IF NOT EXISTS bonds_reports_project_id_idx ON public.bonds_reports (project_id);
CREATE INDEX IF NOT EXISTS bonds_reports_type_idx ON public.bonds_reports (type);

-- Certificates
CREATE TABLE IF NOT EXISTS public.bonds_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  valuation_id uuid NOT NULL REFERENCES public.bonds_valuations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  qr_payload text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_certificates IS 'Canonical digital valuation certificate (BDVC).';

CREATE INDEX IF NOT EXISTS bonds_certificates_valuation_id_idx ON public.bonds_certificates (valuation_id);
CREATE INDEX IF NOT EXISTS bonds_certificates_project_id_idx ON public.bonds_certificates (project_id);
CREATE INDEX IF NOT EXISTS bonds_certificates_number_idx ON public.bonds_certificates (certificate_number);

-- -----------------------------------------------------------------------------
-- 5. Data source catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  url text,
  refresh_interval text,
  confidence_default text NOT NULL DEFAULT 'C',
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_sources IS 'Catalog of external data sources consumed by Live Intelligence.';

CREATE INDEX IF NOT EXISTS data_sources_enabled_idx ON public.data_sources (enabled);

DROP TRIGGER IF EXISTS data_sources_updated_at ON public.data_sources;
CREATE TRIGGER data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Smart Data Override audit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  original_value jsonb,
  override_value jsonb NOT NULL,
  reason text NOT NULL,
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_overrides IS 'Audit trail for every manual override of imported or calculated data.';

CREATE INDEX IF NOT EXISTS data_overrides_entity_idx ON public.data_overrides (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS data_overrides_source_idx ON public.data_overrides (source_id);

-- -----------------------------------------------------------------------------
-- 7. Formula registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formula_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  expression text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL,
  engine text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.formula_registry IS 'Canonical registry of all financial/economic calculation formulas.';

CREATE INDEX IF NOT EXISTS formula_registry_category_idx ON public.formula_registry (category);
CREATE INDEX IF NOT EXISTS formula_registry_engine_idx ON public.formula_registry (engine);
CREATE INDEX IF NOT EXISTS formula_registry_status_idx ON public.formula_registry (status);

DROP TRIGGER IF EXISTS formula_registry_updated_at ON public.formula_registry;
CREATE TRIGGER formula_registry_updated_at
  BEFORE UPDATE ON public.formula_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Business rules registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_rules_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  condition_text text NOT NULL,
  action_text text NOT NULL,
  reason_text text,
  priority text NOT NULL DEFAULT 'High',
  engine text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_rules_registry IS 'Canonical registry of BONDS business rules.';

CREATE INDEX IF NOT EXISTS business_rules_registry_category_idx ON public.business_rules_registry (category);
CREATE INDEX IF NOT EXISTS business_rules_registry_engine_idx ON public.business_rules_registry (engine);
CREATE INDEX IF NOT EXISTS business_rules_registry_status_idx ON public.business_rules_registry (status);

DROP TRIGGER IF EXISTS business_rules_registry_updated_at ON public.business_rules_registry;
CREATE TRIGGER business_rules_registry_updated_at
  BEFORE UPDATE ON public.business_rules_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed foundational rules from Business Rules Catalog
INSERT INTO public.business_rules_registry (code, condition_text, action_text, reason_text, priority, engine, category, metadata)
VALUES
  ('BR-SECTOR-001', 'asset_class == realEstate', 'Hide mileage, model_year, fuel_type, plate_number fields', 'Cars have different fields than real estate', 'High', 'Valuation Engine + Knowledge Engine', 'Sector', '{"rule_id":"R-001"}'),
  ('BR-SECTOR-002', 'sector == restaurant OR activity contains food', 'Show food_cost_percentage, menu_items, ingredient_prices fields', 'Restaurants depend on food cost', 'High', 'Feasibility Engine + Knowledge Engine', 'Sector', '{"rule_id":"R-002"}'),
  ('BR-SECTOR-003', 'sector == manufacturing', 'Show production_lines, capacity_per_line, machine_cost fields', 'Factories need production line details', 'High', 'Feasibility Engine + Valuation Engine', 'Sector', '{"rule_id":"R-003"}'),
  ('BR-SECTOR-004', 'sector == education', 'Show student_capacity, classrooms, tuition_fee fields', 'Schools are measured by capacity', 'High', 'Feasibility Engine', 'Sector', '{"rule_id":"R-004"}'),
  ('BR-SECTOR-005', 'sector == healthcare AND activity contains hospital', 'Show beds, occupancy_rate, avg_patient_revenue fields', 'Hospitals measured by beds and occupancy', 'High', 'Feasibility Engine', 'Sector', '{"rule_id":"R-005"}'),
  ('BR-VAL-001', 'asset_class is known', 'Select valuation methodology based on asset class', 'Each asset has the most suitable methodology', 'Critical', 'Valuation Engine + Knowledge Engine', 'Valuation', '{"rule_id":"R-006"}'),
  ('BR-VAL-002', 'data_quality_score < 80', 'Do not create AI Report', 'Ensure analysis quality', 'Critical', 'Confidence Engine + AI Analyst', 'Valuation', '{"rule_id":"R-007"}'),
  ('BR-CRT-001', 'confidence_score < 85 OR data_quality_score < 80 OR report not approved', 'Do not issue BDVC', 'Protect certificate credibility', 'Critical', 'Certificate Engine', 'Certificate', '{"rule_id":"R-008"}'),
  ('BR-FIN-001', 'dscr < 1.25', 'Warn: high-risk financing', 'Banks usually require DSCR > 1.25', 'High', 'Financing Engine', 'Financing', '{"rule_id":"R-009"}'),
  ('BR-FIN-002', 'ltv > 0.80', 'Reject or request additional collateral', 'Limit credit risk', 'High', 'Financing Engine + Risk Engine', 'Financing', '{"rule_id":"R-010"}'),
  ('BR-SUB-001', 'tier == free', 'Max 3 scenarios, 5 countries, Excel export only', 'Incentivize upgrade and protect resources', 'High', 'Usage Guard', 'Subscription', '{"rule_id":"R-011"}'),
  ('BR-SUB-002', 'tier IN (pro, enterprise)', 'Allow PDF export and access to 22 countries', 'Paid features', 'High', 'Subscription Engine', 'Subscription', '{"rule_id":"R-012"}'),
  ('BR-DATA-001', 'source_confidence == D', 'Do not use datum in calculations without manual confirmation', 'Ensure output quality', 'High', 'Live Intelligence + Confidence Engine', 'Data', '{"rule_id":"R-013"}'),
  ('BR-DATA-002', 'user overrides a data value', 'Log reason, difference and recalculate', 'Smart Data Override transparency', 'High', 'Unified Data Layer + Audit Trail', 'Data', '{"rule_id":"R-014"}'),
  ('BR-AI-001', 'always', 'AI provides analysis and recommendation; final decision is human', 'Human responsibility and compliance', 'Critical', 'AI Analyst + Recommendation Engine', 'AI', '{"rule_id":"R-015"}'),
  ('BR-AI-002', 'always', 'AI output must conform to defined JSON schema', 'Processability and validation', 'Critical', 'AI Analyst', 'AI', '{"rule_id":"R-016"}'),
  ('BR-SEC-001', 'always', 'Do not expose API Key or Secret in frontend', 'Protect systems', 'Critical', 'Security Layer', 'Security', '{"rule_id":"R-017"}'),
  ('BR-SEC-002', 'always', 'Enable RLS on all sensitive tables', 'Isolate user data', 'Critical', 'Database', 'Security', '{"rule_id":"R-018"}'),
  ('BR-WF-001', 'project status == submitted', 'Only Reviewer can edit data', 'Controlled review process', 'High', 'Workflow Engine', 'Workflow', '{"rule_id":"R-019"}'),
  ('BR-WF-002', 'report status == rejected', 'Return to Owner with notes', 'Quality loop', 'High', 'Workflow Engine', 'Workflow', '{"rule_id":"R-020"}'),
  ('BR-AUD-001', 'any sensitive data change', 'Log in Audit Trail', 'Auditability', 'Critical', 'Audit Trail', 'Audit', '{"rule_id":"R-021"}'),
  ('BR-I18N-001', 'language == ar', 'RTL layout and Arabic/English numbers', 'Arabic UX', 'High', 'UI Layer', 'i18n', '{"rule_id":"R-022"}'),
  ('BR-I18N-002', 'language == en', 'LTR layout', 'English UX', 'High', 'UI Layer', 'i18n', '{"rule_id":"R-023"}')
ON CONFLICT (code) DO UPDATE SET
  condition_text = EXCLUDED.condition_text,
  action_text = EXCLUDED.action_text,
  reason_text = EXCLUDED.reason_text,
  priority = EXCLUDED.priority,
  engine = EXCLUDED.engine,
  category = EXCLUDED.category,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 9. Canonical audit log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.bonds_audit_logs IS 'Canonical audit trail for all BONDS data changes.';

CREATE INDEX IF NOT EXISTS bonds_audit_logs_record_idx ON public.bonds_audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS bonds_audit_logs_performed_at_idx ON public.bonds_audit_logs (performed_at);

-- -----------------------------------------------------------------------------
-- 10. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.bonds_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_financing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_audit_logs ENABLE ROW LEVEL SECURITY;

-- User owns their project rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_projects' AND policyname = 'bonds_projects_user_isolation'
  ) THEN
    CREATE POLICY bonds_projects_user_isolation ON public.bonds_projects
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_assets' AND policyname = 'bonds_assets_user_isolation'
  ) THEN
    CREATE POLICY bonds_assets_user_isolation ON public.bonds_assets
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_assets.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_assets.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_valuations' AND policyname = 'bonds_valuations_user_isolation'
  ) THEN
    CREATE POLICY bonds_valuations_user_isolation ON public.bonds_valuations
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_valuations.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_valuations.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_financing' AND policyname = 'bonds_financing_user_isolation'
  ) THEN
    CREATE POLICY bonds_financing_user_isolation ON public.bonds_financing
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_financing.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_financing.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_reports' AND policyname = 'bonds_reports_user_isolation'
  ) THEN
    CREATE POLICY bonds_reports_user_isolation ON public.bonds_reports
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_reports.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_reports.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_certificates' AND policyname = 'bonds_certificates_user_isolation'
  ) THEN
    CREATE POLICY bonds_certificates_user_isolation ON public.bonds_certificates
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_certificates.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_certificates.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'data_overrides' AND policyname = 'data_overrides_user_isolation'
  ) THEN
    CREATE POLICY data_overrides_user_isolation ON public.data_overrides
      USING (overridden_by = auth.uid())
      WITH CHECK (overridden_by = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_audit_logs' AND policyname = 'bonds_audit_logs_user_isolation'
  ) THEN
    CREATE POLICY bonds_audit_logs_user_isolation ON public.bonds_audit_logs
      USING (performed_by = auth.uid())
      WITH CHECK (performed_by = auth.uid());
  END IF;
END $$;

-- Service role bypass for all new tables
DO $$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bonds_sequences', 'bonds_objects', 'bonds_projects', 'bonds_assets',
    'bonds_valuations', 'bonds_financing', 'bonds_reports', 'bonds_certificates',
    'data_sources', 'data_overrides', 'formula_registry', 'business_rules_registry', 'bonds_audit_logs'
  ]
  LOOP
    pol_name := tbl || '_service_role';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        pol_name, tbl
      );
    END IF;
  END LOOP;
END $$;
