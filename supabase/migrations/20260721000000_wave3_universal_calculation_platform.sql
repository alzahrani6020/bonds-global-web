-- Wave 3 — Universal Calculation Platform (UCP)
-- Registries and calculation runs for template-driven, sector-agnostic calculation.

-- -----------------------------------------------------------------------------
-- 1. Calculation Templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sector text NOT NULL,
  country text,
  version integer NOT NULL DEFAULT 1,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  scenario_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_template text,
  certificate_template text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_templates IS 'UCP calculation templates per sector/country.';

CREATE INDEX IF NOT EXISTS ucp_templates_sector_idx ON public.ucp_templates (sector);
CREATE INDEX IF NOT EXISTS ucp_templates_country_idx ON public.ucp_templates (country);
CREATE INDEX IF NOT EXISTS ucp_templates_status_idx ON public.ucp_templates (status);

DROP TRIGGER IF EXISTS ucp_templates_updated_at ON public.ucp_templates;
CREATE TRIGGER ucp_templates_updated_at
  BEFORE UPDATE ON public.ucp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Validation Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_validation_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  field text,
  validation_type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  sector text,
  country text,
  applies_to text,
  error_message text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_validation_registry IS 'Reusable validation rules for UCP calculations.';

CREATE INDEX IF NOT EXISTS ucp_validation_registry_sector_idx ON public.ucp_validation_registry (sector);
CREATE INDEX IF NOT EXISTS ucp_validation_registry_type_idx ON public.ucp_validation_registry (validation_type);

DROP TRIGGER IF EXISTS ucp_validation_registry_updated_at ON public.ucp_validation_registry;
CREATE TRIGGER ucp_validation_registry_updated_at
  BEFORE UPDATE ON public.ucp_validation_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Scenario Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_scenario_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  scenario_type text NOT NULL,
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  sector text,
  country text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_scenario_registry IS 'Scenario definitions for UCP calculations.';

CREATE INDEX IF NOT EXISTS ucp_scenario_registry_sector_idx ON public.ucp_scenario_registry (sector);
CREATE INDEX IF NOT EXISTS ucp_scenario_registry_type_idx ON public.ucp_scenario_registry (scenario_type);

DROP TRIGGER IF EXISTS ucp_scenario_registry_updated_at ON public.ucp_scenario_registry;
CREATE TRIGGER ucp_scenario_registry_updated_at
  BEFORE UPDATE ON public.ucp_scenario_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Weight Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_weight_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  context_key text NOT NULL,
  context_value text,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  effective_to date,
  sector text,
  country text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_weight_registry IS 'Configurable weights per context for UCP calculations.';

CREATE INDEX IF NOT EXISTS ucp_weight_registry_context_idx ON public.ucp_weight_registry (context_key, context_value);
CREATE INDEX IF NOT EXISTS ucp_weight_registry_sector_idx ON public.ucp_weight_registry (sector);

DROP TRIGGER IF EXISTS ucp_weight_registry_updated_at ON public.ucp_weight_registry;
CREATE TRIGGER ucp_weight_registry_updated_at
  BEFORE UPDATE ON public.ucp_weight_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Policy Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_policy_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  country text,
  sector text,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_policy_registry IS 'Country, regulatory and industry policies for UCP.';

CREATE INDEX IF NOT EXISTS ucp_policy_registry_category_idx ON public.ucp_policy_registry (category);
CREATE INDEX IF NOT EXISTS ucp_policy_registry_country_idx ON public.ucp_policy_registry (country);

DROP TRIGGER IF EXISTS ucp_policy_registry_updated_at ON public.ucp_policy_registry;
CREATE TRIGGER ucp_policy_registry_updated_at
  BEFORE UPDATE ON public.ucp_policy_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Calculation Runs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  template_id uuid REFERENCES public.ucp_templates(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE SET NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_calculation_runs IS 'Audit log of every UCP calculation run.';

CREATE INDEX IF NOT EXISTS ucp_calculation_runs_template_id_idx ON public.ucp_calculation_runs (template_id);
CREATE INDEX IF NOT EXISTS ucp_calculation_runs_user_id_idx ON public.ucp_calculation_runs (user_id);
CREATE INDEX IF NOT EXISTS ucp_calculation_runs_project_id_idx ON public.ucp_calculation_runs (project_id);
CREATE INDEX IF NOT EXISTS ucp_calculation_runs_created_at_idx ON public.ucp_calculation_runs (created_at);

-- -----------------------------------------------------------------------------
-- 7. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.ucp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_validation_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_scenario_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_weight_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_policy_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_calculation_runs ENABLE ROW LEVEL SECURITY;

-- Templates, registries and runs are readable by authenticated users.
-- In a real deployment these may be admin-managed; service_role handles writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_templates' AND policyname = 'ucp_templates_read'
  ) THEN
    CREATE POLICY ucp_templates_read ON public.ucp_templates FOR SELECT TO authenticated USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_validation_registry' AND policyname = 'ucp_validation_registry_read'
  ) THEN
    CREATE POLICY ucp_validation_registry_read ON public.ucp_validation_registry FOR SELECT TO authenticated USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_scenario_registry' AND policyname = 'ucp_scenario_registry_read'
  ) THEN
    CREATE POLICY ucp_scenario_registry_read ON public.ucp_scenario_registry FOR SELECT TO authenticated USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_weight_registry' AND policyname = 'ucp_weight_registry_read'
  ) THEN
    CREATE POLICY ucp_weight_registry_read ON public.ucp_weight_registry FOR SELECT TO authenticated USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_policy_registry' AND policyname = 'ucp_policy_registry_read'
  ) THEN
    CREATE POLICY ucp_policy_registry_read ON public.ucp_policy_registry FOR SELECT TO authenticated USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_calculation_runs' AND policyname = 'ucp_calculation_runs_user_isolation'
  ) THEN
    CREATE POLICY ucp_calculation_runs_user_isolation ON public.ucp_calculation_runs
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Service role bypass
DO $$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ucp_templates', 'ucp_validation_registry', 'ucp_scenario_registry',
    'ucp_weight_registry', 'ucp_policy_registry', 'ucp_calculation_runs'
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
