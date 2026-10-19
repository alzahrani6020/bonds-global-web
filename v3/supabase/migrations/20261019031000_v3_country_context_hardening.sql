-- Bonds V3 — Country context hardening and explicit legacy boundaries

ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS labor_localization_rate numeric;

UPDATE public.city_market_data cmd
SET labor_localization_rate = cmd.saudization_rate
FROM public.cities c
WHERE c.id = cmd.city_id
  AND c.country_code = 'SA'
  AND cmd.saudization_rate IS NOT NULL
  AND cmd.labor_localization_rate IS NULL;

COMMENT ON COLUMN public.city_market_data.saudization_rate IS
  'Legacy Saudi-specific field. Do not use for non-SA countries. Use labor_localization_rate for generalized country-aware logic.';
COMMENT ON COLUMN public.city_market_data.labor_localization_rate IS
  'Country-neutral workforce localization rate. Currently backfilled only for Saudi Arabia from the legacy saudization_rate field.';

-- Establish explicit model coverage for every supported country without inventing
-- localized financial values. Saudi Arabia is marked estimated because current
-- shared project models are SAR-based legacy baselines; every other country stays
-- unverified until local values are sourced.
INSERT INTO public.country_model_overrides (
  project_model_id,
  country_code,
  currency_code,
  status,
  capex_min,
  capex_max,
  revenue_min,
  revenue_max,
  land_cost_min,
  land_cost_avg,
  land_cost_max,
  construction_cost_per_sqm,
  equipment_cost_min,
  equipment_cost_avg,
  equipment_cost_max,
  monthly_operation_cost_min,
  monthly_operation_cost_avg,
  monthly_operation_cost_max,
  source,
  confidence,
  metadata
)
SELECT
  pm.id,
  cp.country_code,
  cp.currency_code,
  CASE WHEN cp.country_code = 'SA' THEN 'estimated' ELSE 'unverified' END,
  CASE WHEN cp.country_code = 'SA' THEN pm.capex_min ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.capex_max ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.revenue_min ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.revenue_max ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.land_cost_min ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.land_cost_avg ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.land_cost_max ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.construction_cost_per_sqm ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.equipment_cost_min ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.equipment_cost_avg ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.equipment_cost_max ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.monthly_operation_cost_min ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.monthly_operation_cost_avg ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN pm.monthly_operation_cost_max ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN 'legacy_sar_project_model' ELSE NULL END,
  CASE WHEN cp.country_code = 'SA' THEN 50 ELSE NULL END,
  jsonb_build_object(
    'generatedCoverageRow', true,
    'localizedValuesPresent', cp.country_code = 'SA',
    'crossCountryFallbackAllowed', false
  )
FROM public.project_models pm
CROSS JOIN public.country_profiles cp
WHERE cp.is_supported = true
ON CONFLICT (project_model_id, country_code) DO NOTHING;

-- Activate the source registry with the external source already represented in
-- country_indicator_observations. This does not claim national-agency feeds exist.
INSERT INTO public.data_sources (
  source_code,
  name,
  category,
  url,
  refresh_interval,
  confidence_default,
  connector_code,
  supported_countries,
  supported_operations,
  license,
  owner,
  cost_model,
  trust_anchor,
  refresh_policy,
  status,
  metadata
)
VALUES (
  'world_bank_open_data',
  'World Bank Open Data',
  'official_external',
  'https://data.worldbank.org/',
  'daily',
  'A',
  'world_bank',
  ARRAY['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'],
  ARRAY['country_indicators'],
  'World Bank Terms of Use',
  'World Bank',
  'free',
  'official_multilateral',
  '{"mode":"incremental","maxAgeHours":6}'::jsonb,
  'active',
  '{"scope":"country","observationTable":"country_indicator_observations"}'::jsonb
)
ON CONFLICT (source_code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  url = EXCLUDED.url,
  refresh_interval = EXCLUDED.refresh_interval,
  supported_countries = EXCLUDED.supported_countries,
  supported_operations = EXCLUDED.supported_operations,
  trust_anchor = EXCLUDED.trust_anchor,
  refresh_policy = EXCLUDED.refresh_policy,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
