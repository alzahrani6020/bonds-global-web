-- =============================================================================
-- Wave 4.2 — Trusted Data Fabric & Enterprise Data Platform
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend existing data_sources catalog with enterprise connector metadata
-- -----------------------------------------------------------------------------
ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS connector_code text,
  ADD COLUMN IF NOT EXISTS supported_countries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_industries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_operations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS cost_model text,
  ADD COLUMN IF NOT EXISTS trust_anchor text,
  ADD COLUMN IF NOT EXISTS refresh_policy jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS data_sources_connector_code_idx ON public.data_sources (connector_code);
CREATE INDEX IF NOT EXISTS data_sources_status_idx ON public.data_sources (status);

COMMENT ON COLUMN public.data_sources.connector_code IS 'Maps this source to a lib/fabric connector implementation.';
COMMENT ON COLUMN public.data_sources.trust_anchor IS 'Highest confidence tier this source can claim (official, open_data, manual, etc.).';

-- -----------------------------------------------------------------------------
-- 2. Connector definitions / manifests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_connector_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  auth_type jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_limit jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  cache_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  supported_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_countries text[] DEFAULT '{}',
  supported_industries text[] DEFAULT '{}',
  supported_operations text[] DEFAULT '{}',
  manifest_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_connector_definitions IS 'Enterprise connector interface definitions and manifests for the Trusted Data Fabric.';

CREATE INDEX IF NOT EXISTS fabric_connector_definitions_category_idx ON public.fabric_connector_definitions (category);
CREATE INDEX IF NOT EXISTS fabric_connector_definitions_status_idx ON public.fabric_connector_definitions (status);

DROP TRIGGER IF EXISTS fabric_connector_definitions_updated_at ON public.fabric_connector_definitions;
CREATE TRIGGER fabric_connector_definitions_updated_at
  BEFORE UPDATE ON public.fabric_connector_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Dynamic source rankings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_source_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  trust_score integer NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  reliability_score integer NOT NULL DEFAULT 0 CHECK (reliability_score BETWEEN 0 AND 100),
  availability_score integer NOT NULL DEFAULT 0 CHECK (availability_score BETWEEN 0 AND 100),
  freshness_score integer NOT NULL DEFAULT 0 CHECK (freshness_score BETWEEN 0 AND 100),
  coverage_score integer NOT NULL DEFAULT 0 CHECK (coverage_score BETWEEN 0 AND 100),
  accuracy_score integer NOT NULL DEFAULT 0 CHECK (accuracy_score BETWEEN 0 AND 100),
  consistency_score integer NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 100),
  historical_success_score integer NOT NULL DEFAULT 0 CHECK (historical_success_score BETWEEN 0 AND 100),
  response_time_score integer NOT NULL DEFAULT 0 CHECK (response_time_score BETWEEN 0 AND 100),
  overall_score integer NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  details jsonb DEFAULT '{}'::jsonb,
  scored_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_source_rankings IS 'Dynamic trust and quality scores computed by the Source Ranking Engine.';

CREATE INDEX IF NOT EXISTS fabric_source_rankings_source_idx ON public.fabric_source_rankings (source_id);
CREATE INDEX IF NOT EXISTS fabric_source_rankings_scored_at_idx ON public.fabric_source_rankings (scored_at);

-- -----------------------------------------------------------------------------
-- 4. Data provenance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  value jsonb,
  source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.data_source_runs(id) ON DELETE SET NULL,
  connector_code text,
  collected_at timestamptz,
  confidence integer CHECK (confidence BETWEEN 0 AND 100),
  evidence jsonb DEFAULT '{}'::jsonb,
  previous_provenance_id uuid REFERENCES public.fabric_provenance(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_provenance IS 'Full lineage: where every value came from, who changed it, and why.';

CREATE INDEX IF NOT EXISTS fabric_provenance_entity_idx ON public.fabric_provenance (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS fabric_provenance_source_idx ON public.fabric_provenance (source_id);
CREATE INDEX IF NOT EXISTS fabric_provenance_created_at_idx ON public.fabric_provenance (created_at);

-- -----------------------------------------------------------------------------
-- 5. Consensus results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL,
  context_type text,
  context_id uuid,
  value jsonb NOT NULL,
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  method text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_estimated boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_consensus IS 'Multi-source consensus output with stored alternatives.';

CREATE INDEX IF NOT EXISTS fabric_consensus_metric_context_idx ON public.fabric_consensus (metric_code, context_type, context_id);
CREATE INDEX IF NOT EXISTS fabric_consensus_computed_at_idx ON public.fabric_consensus (computed_at);

-- -----------------------------------------------------------------------------
-- 6. Conflict resolution records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL,
  context_type text,
  context_id uuid,
  source_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  selected_value jsonb,
  confidence integer CHECK (confidence BETWEEN 0 AND 100),
  resolution_method text NOT NULL,
  explanation text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

COMMENT ON TABLE public.fabric_conflicts IS 'Detected conflicts and how they were resolved.';

CREATE INDEX IF NOT EXISTS fabric_conflicts_metric_context_idx ON public.fabric_conflicts (metric_code, context_type, context_id);
CREATE INDEX IF NOT EXISTS fabric_conflicts_created_at_idx ON public.fabric_conflicts (created_at);

-- -----------------------------------------------------------------------------
-- 7. Data quality scores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_data_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  metric_code text NOT NULL,
  context_type text,
  context_id uuid,
  completeness integer CHECK (completeness BETWEEN 0 AND 100),
  accuracy integer CHECK (accuracy BETWEEN 0 AND 100),
  consistency integer CHECK (consistency BETWEEN 0 AND 100),
  uniqueness integer CHECK (uniqueness BETWEEN 0 AND 100),
  validity integer CHECK (validity BETWEEN 0 AND 100),
  integrity integer CHECK (integrity BETWEEN 0 AND 100),
  timeliness integer CHECK (timeliness BETWEEN 0 AND 100),
  availability integer CHECK (availability BETWEEN 0 AND 100),
  overall_score integer CHECK (overall_score BETWEEN 0 AND 100),
  details jsonb DEFAULT '{}'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_data_quality IS 'Per-value/per-context data quality dimensions from the Data Quality Engine.';

CREATE INDEX IF NOT EXISTS fabric_data_quality_metric_context_idx ON public.fabric_data_quality (metric_code, context_type, context_id);
CREATE INDEX IF NOT EXISTS fabric_data_quality_source_idx ON public.fabric_data_quality (source_id);

-- -----------------------------------------------------------------------------
-- 8. Refresh policies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_refresh_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  metric_code text,
  max_age_seconds integer NOT NULL DEFAULT 86400,
  refresh_cron text,
  auto_refresh boolean NOT NULL DEFAULT false,
  last_refresh timestamptz,
  next_refresh timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_refresh_policies IS 'Freshness and automatic refresh policy per source/metric.';

CREATE INDEX IF NOT EXISTS fabric_refresh_policies_source_idx ON public.fabric_refresh_policies (source_id);
CREATE INDEX IF NOT EXISTS fabric_refresh_policies_next_refresh_idx ON public.fabric_refresh_policies (next_refresh);

DROP TRIGGER IF EXISTS fabric_refresh_policies_updated_at ON public.fabric_refresh_policies;
CREATE TRIGGER fabric_refresh_policies_updated_at
  BEFORE UPDATE ON public.fabric_refresh_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. Observability events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_observability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  connector_code text,
  source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  metric_code text,
  status text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_observability_events IS 'Imports, refreshes, overrides, failures, retries, cache and health events.';

CREATE INDEX IF NOT EXISTS fabric_observability_events_type_idx ON public.fabric_observability_events (event_type);
CREATE INDEX IF NOT EXISTS fabric_observability_events_connector_idx ON public.fabric_observability_events (connector_code);
CREATE INDEX IF NOT EXISTS fabric_observability_events_created_at_idx ON public.fabric_observability_events (created_at);

-- -----------------------------------------------------------------------------
-- 10. Decision impact records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_decision_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  impacted_assets jsonb DEFAULT '[]'::jsonb,
  impacted_projects jsonb DEFAULT '[]'::jsonb,
  impacted_reports jsonb DEFAULT '[]'::jsonb,
  impacted_certificates jsonb DEFAULT '[]'::jsonb,
  impacted_financing jsonb DEFAULT '[]'::jsonb,
  impacted_scenarios jsonb DEFAULT '[]'::jsonb,
  recalculation_status text DEFAULT 'pending',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_decision_impacts IS 'Affected assets, projects, reports and certificates after data changes.';

CREATE INDEX IF NOT EXISTS fabric_decision_impacts_entity_idx ON public.fabric_decision_impacts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS fabric_decision_impacts_status_idx ON public.fabric_decision_impacts (recalculation_status);

-- -----------------------------------------------------------------------------
-- 11. Marketplace foundation catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL UNIQUE,
  item_type text NOT NULL,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  owner text,
  license text,
  price_model jsonb DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_marketplace_items IS 'Platform marketplace catalog: templates, connectors, reports, policies, rules, formulas, plugins.';

CREATE INDEX IF NOT EXISTS fabric_marketplace_items_type_idx ON public.fabric_marketplace_items (item_type);
CREATE INDEX IF NOT EXISTS fabric_marketplace_items_status_idx ON public.fabric_marketplace_items (status);

DROP TRIGGER IF EXISTS fabric_marketplace_items_updated_at ON public.fabric_marketplace_items;
CREATE TRIGGER fabric_marketplace_items_updated_at
  BEFORE UPDATE ON public.fabric_marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 12. Plugin registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  version text NOT NULL,
  signature text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_versions jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_plugins IS 'Plugin SDK registry with manifest, permissions, dependencies and digital signature.';

CREATE INDEX IF NOT EXISTS fabric_plugins_status_idx ON public.fabric_plugins (status);

DROP TRIGGER IF EXISTS fabric_plugins_updated_at ON public.fabric_plugins;
CREATE TRIGGER fabric_plugins_updated_at
  BEFORE UPDATE ON public.fabric_plugins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 13. Enterprise API contract registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fabric_api_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL UNIQUE,
  version text NOT NULL,
  lifecycle text NOT NULL DEFAULT 'active',
  owner text,
  permission text,
  dependencies jsonb DEFAULT '[]'::jsonb,
  evidence_source text,
  confidence integer CHECK (confidence BETWEEN 0 AND 100),
  cache_policy jsonb DEFAULT '{}'::jsonb,
  retry_policy jsonb DEFAULT '{}'::jsonb,
  adr_reference text,
  documentation_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fabric_api_contracts IS 'Enterprise API contract metadata registry.';

DROP TRIGGER IF EXISTS fabric_api_contracts_updated_at ON public.fabric_api_contracts;
CREATE TRIGGER fabric_api_contracts_updated_at
  BEFORE UPDATE ON public.fabric_api_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
