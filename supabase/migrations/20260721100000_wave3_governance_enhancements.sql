-- Wave 3 Governance Enhancements
-- Adds missing registries required by Universal Calculation Platform governance:
-- Input/Output definitions, business formulas, dependencies, versions, configurations,
-- plugins, evidence, and Universal Asset Model tables.
-- Idempotent; safe to re-run.

-- -----------------------------------------------------------------------------
-- 1. Versioning columns on existing registries
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'formula_registry' AND column_name = 'effective_from'
  ) THEN
    ALTER TABLE public.formula_registry ADD COLUMN effective_from date;
    ALTER TABLE public.formula_registry ADD COLUMN effective_to date;
    ALTER TABLE public.formula_registry ADD COLUMN owner text;
    ALTER TABLE public.formula_registry ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';
    ALTER TABLE public.formula_registry ADD COLUMN review_cycle text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_rules_registry' AND column_name = 'effective_from'
  ) THEN
    ALTER TABLE public.business_rules_registry ADD COLUMN effective_from date;
    ALTER TABLE public.business_rules_registry ADD COLUMN effective_to date;
    ALTER TABLE public.business_rules_registry ADD COLUMN owner text;
    ALTER TABLE public.business_rules_registry ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';
    ALTER TABLE public.business_rules_registry ADD COLUMN review_cycle text;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Input Definition Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_input_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  data_type text NOT NULL DEFAULT 'number',
  unit_code text,
  sector text,
  country text,
  required boolean NOT NULL DEFAULT true,
  validation_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value jsonb,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  effective_from date,
  effective_to date,
  owner text,
  approval_status text NOT NULL DEFAULT 'draft',
  review_cycle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_input_definitions IS 'Canonical definitions of all calculation inputs.';

CREATE INDEX IF NOT EXISTS ucp_input_definitions_sector_idx ON public.ucp_input_definitions (sector);
CREATE INDEX IF NOT EXISTS ucp_input_definitions_country_idx ON public.ucp_input_definitions (country);
CREATE INDEX IF NOT EXISTS ucp_input_definitions_status_idx ON public.ucp_input_definitions (status);

DROP TRIGGER IF EXISTS ucp_input_definitions_updated_at ON public.ucp_input_definitions;
CREATE TRIGGER ucp_input_definitions_updated_at
  BEFORE UPDATE ON public.ucp_input_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Output Definition Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_output_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  data_type text NOT NULL DEFAULT 'number',
  unit_code text,
  sector text,
  country text,
  formula_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_formula_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  effective_from date,
  effective_to date,
  owner text,
  approval_status text NOT NULL DEFAULT 'draft',
  review_cycle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_output_definitions IS 'Canonical definitions of all calculation outputs.';

CREATE INDEX IF NOT EXISTS ucp_output_definitions_sector_idx ON public.ucp_output_definitions (sector);
CREATE INDEX IF NOT EXISTS ucp_output_definitions_status_idx ON public.ucp_output_definitions (status);

DROP TRIGGER IF EXISTS ucp_output_definitions_updated_at ON public.ucp_output_definitions;
CREATE TRIGGER ucp_output_definitions_updated_at
  BEFORE UPDATE ON public.ucp_output_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Business Formula Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_business_formula_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  expression text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL,
  engine text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  effective_from date,
  effective_to date,
  owner text,
  approval_status text NOT NULL DEFAULT 'draft',
  review_cycle text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_business_formula_registry IS 'Business-level formulas distinct from mathematical formula_registry.';

CREATE INDEX IF NOT EXISTS ucp_business_formula_category_idx ON public.ucp_business_formula_registry (category);
CREATE INDEX IF NOT EXISTS ucp_business_formula_status_idx ON public.ucp_business_formula_registry (status);

DROP TRIGGER IF EXISTS ucp_business_formula_registry_updated_at ON public.ucp_business_formula_registry;
CREATE TRIGGER ucp_business_formula_registry_updated_at
  BEFORE UPDATE ON public.ucp_business_formula_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Dependency Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_code text NOT NULL,
  depends_on_type text NOT NULL,
  depends_on_code text NOT NULL,
  dependency_type text NOT NULL DEFAULT 'hard',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_code, depends_on_type, depends_on_code)
);

COMMENT ON TABLE public.ucp_dependencies IS 'Central dependency graph between registries and calculation elements.';

CREATE INDEX IF NOT EXISTS ucp_dependencies_source_idx ON public.ucp_dependencies (source_type, source_code);
CREATE INDEX IF NOT EXISTS ucp_dependencies_target_idx ON public.ucp_dependencies (depends_on_type, depends_on_code);

DROP TRIGGER IF EXISTS ucp_dependencies_updated_at ON public.ucp_dependencies;
CREATE TRIGGER ucp_dependencies_updated_at
  BEFORE UPDATE ON public.ucp_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Version Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_code text NOT NULL,
  version integer NOT NULL,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'draft',
  migration_notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_code, version)
);

COMMENT ON TABLE public.ucp_versions IS 'Version history and approval status for all registry items.';

CREATE INDEX IF NOT EXISTS ucp_versions_entity_idx ON public.ucp_versions (entity_type, entity_code);
CREATE INDEX IF NOT EXISTS ucp_versions_status_idx ON public.ucp_versions (status);

-- -----------------------------------------------------------------------------
-- 7. Configuration Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_key text NOT NULL,
  context_value text,
  config_type text NOT NULL,
  config_code text NOT NULL,
  value jsonb NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_key, context_value, config_type, config_code)
);

COMMENT ON TABLE public.ucp_configurations IS 'Configuration overrides per sector/country/policy without code changes.';

CREATE INDEX IF NOT EXISTS ucp_configurations_context_idx ON public.ucp_configurations (context_key, context_value);
CREATE INDEX IF NOT EXISTS ucp_configurations_type_idx ON public.ucp_configurations (config_type);

DROP TRIGGER IF EXISTS ucp_configurations_updated_at ON public.ucp_configurations;
CREATE TRIGGER ucp_configurations_updated_at
  BEFORE UPDATE ON public.ucp_configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Plugin Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  plugin_type text NOT NULL,
  entry_point text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_plugins IS 'Approved plugin extensions for UCP.';

CREATE INDEX IF NOT EXISTS ucp_plugins_type_idx ON public.ucp_plugins (plugin_type);
CREATE INDEX IF NOT EXISTS ucp_plugins_status_idx ON public.ucp_plugins (status);

DROP TRIGGER IF EXISTS ucp_plugins_updated_at ON public.ucp_plugins;
CREATE TRIGGER ucp_plugins_updated_at
  BEFORE UPDATE ON public.ucp_plugins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. Evidence Registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_run_id uuid REFERENCES public.ucp_calculation_runs(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  evidence_code text NOT NULL,
  source text,
  value jsonb,
  confidence numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_evidence IS 'Explainability evidence attached to each calculation run.';

CREATE INDEX IF NOT EXISTS ucp_evidence_run_idx ON public.ucp_evidence (calculation_run_id);
CREATE INDEX IF NOT EXISTS ucp_evidence_type_idx ON public.ucp_evidence (evidence_type);

-- -----------------------------------------------------------------------------
-- 10. Universal Asset Model
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucp_asset_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  asset_class text NOT NULL,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifecycle jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_asset_models IS 'Universal Asset Model blueprints per asset class.';

CREATE INDEX IF NOT EXISTS ucp_asset_models_class_idx ON public.ucp_asset_models (asset_class);
CREATE INDEX IF NOT EXISTS ucp_asset_models_status_idx ON public.ucp_asset_models (status);

DROP TRIGGER IF EXISTS ucp_asset_models_updated_at ON public.ucp_asset_models;
CREATE TRIGGER ucp_asset_models_updated_at
  BEFORE UPDATE ON public.ucp_asset_models
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ucp_asset_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_model_id uuid NOT NULL REFERENCES public.ucp_asset_models(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ucp_asset_instances IS 'Instances of Universal Asset Model.';

CREATE INDEX IF NOT EXISTS ucp_asset_instances_model_idx ON public.ucp_asset_instances (asset_model_id);
CREATE INDEX IF NOT EXISTS ucp_asset_instances_project_idx ON public.ucp_asset_instances (project_id);

DROP TRIGGER IF EXISTS ucp_asset_instances_updated_at ON public.ucp_asset_instances;
CREATE TRIGGER ucp_asset_instances_updated_at
  BEFORE UPDATE ON public.ucp_asset_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.ucp_input_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_output_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_business_formula_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_asset_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucp_asset_instances ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ucp_input_definitions', 'ucp_output_definitions', 'ucp_business_formula_registry',
    'ucp_dependencies', 'ucp_versions', 'ucp_configurations', 'ucp_plugins',
    'ucp_evidence', 'ucp_asset_models', 'ucp_asset_instances'
  ]
  LOOP
    pol_name := tbl || '_read_active';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (status = ''active'');',
        pol_name, tbl
      );
    END IF;

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

-- Evidence is tied to calculation runs; reuse run isolation via join.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ucp_evidence' AND policyname = 'ucp_evidence_user_isolation'
  ) THEN
    CREATE POLICY ucp_evidence_user_isolation ON public.ucp_evidence
      USING (EXISTS (
        SELECT 1 FROM public.ucp_calculation_runs r
        WHERE r.id = ucp_evidence.calculation_run_id AND r.user_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.ucp_calculation_runs r
        WHERE r.id = ucp_evidence.calculation_run_id AND r.user_id = auth.uid()
      ));
  END IF;
END $$;
