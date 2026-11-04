-- Attach every legacy alias sector onto its canonical activity, then treat a
-- project model as mapped when that investment sector is present — not only
-- when it is the activity's single primary sector.
-- Generic activities (cleaning, consulting, security, maintenance) are reused
-- across many economic sectors after semantic consolidation.

INSERT INTO public.canonical_activity_investment_sectors (
  canonical_activity_id, sector_id, is_primary, source, confidence, metadata
)
SELECT DISTINCT
  ala.canonical_activity_id,
  lsim.investment_sector_id,
  false,
  'legacy_alias_sector_backfill',
  80,
  jsonb_build_object('origin', 'economic_activity_sector')
FROM public.canonical_activity_legacy_aliases ala
JOIN public.economic_activities a
  ON a.id = ala.legacy_activity_id
JOIN public.canonical_activities ca
  ON ca.id = ala.canonical_activity_id
 AND ca.superseded_by IS NULL
JOIN public.legacy_sector_investment_map lsim
  ON lsim.economic_sector_id = a.sector_id
 AND lsim.is_primary = true
ON CONFLICT (canonical_activity_id, sector_id) DO NOTHING;

INSERT INTO public.canonical_activity_investment_sectors (
  canonical_activity_id, sector_id, is_primary, source, confidence, metadata
)
SELECT DISTINCT
  ala.canonical_activity_id,
  lsim.investment_sector_id,
  false,
  'legacy_alias_sector_backfill',
  80,
  jsonb_build_object('origin', 'project_model_sector')
FROM public.project_models pm
JOIN public.canonical_activity_legacy_aliases ala
  ON ala.legacy_activity_id = pm.activity_id
JOIN public.canonical_activities ca
  ON ca.id = ala.canonical_activity_id
 AND ca.superseded_by IS NULL
JOIN public.legacy_sector_investment_map lsim
  ON lsim.economic_sector_id = pm.sector_id
 AND lsim.is_primary = true
WHERE pm.is_published IS TRUE
  AND pm.is_active IS TRUE
ON CONFLICT (canonical_activity_id, sector_id) DO NOTHING;

CREATE OR REPLACE VIEW public.project_model_canonical_reconciliation AS
SELECT
  pm.id,
  pm.code,
  pm.is_active,
  pm.is_published,
  pm.size_category,
  pm.activity_id AS legacy_activity_id,
  pm.sector_id AS legacy_sector_id,
  ca.id AS canonical_activity_id,
  ca.code AS canonical_activity_code,
  ca.is_active AS canonical_activity_is_active,
  lsim.investment_sector_id,
  cais.sector_id AS canonical_primary_sector_id,
  concat_ws(
    '|',
    COALESCE(pm.size_category, ''),
    COALESCE(pm.capex_min::text, ''),
    COALESCE(pm.capex_max::text, ''),
    COALESCE(pm.revenue_min::text, ''),
    COALESCE(pm.revenue_max::text, ''),
    COALESCE(pm.employee_count_min::text, ''),
    COALESCE(pm.employee_count_max::text, ''),
    COALESCE(pm.typical_roi_months::text, '')
  ) AS financial_profile_key,
  CASE
    WHEN pm.is_published IS NOT TRUE OR pm.is_active IS NOT TRUE THEN 'unpublished'
    WHEN ala.canonical_activity_id IS NULL OR lsim.investment_sector_id IS NULL THEN 'unmapped'
    WHEN ca.is_active IS NOT TRUE THEN 'inactive'
    WHEN EXISTS (
      SELECT 1
      FROM public.canonical_activity_investment_sectors matched
      WHERE matched.canonical_activity_id = ca.id
        AND matched.sector_id = lsim.investment_sector_id
    ) THEN 'mapped'
    ELSE 'ambiguous'
  END AS mapping_status
FROM public.project_models pm
LEFT JOIN public.canonical_activity_legacy_aliases ala
  ON ala.legacy_activity_id = pm.activity_id
LEFT JOIN public.canonical_activities ca
  ON ca.id = ala.canonical_activity_id
LEFT JOIN public.legacy_sector_investment_map lsim
  ON lsim.economic_sector_id = pm.sector_id
 AND lsim.is_primary = true
LEFT JOIN public.canonical_activity_investment_sectors cais
  ON cais.canonical_activity_id = ca.id
 AND cais.is_primary = true;

ALTER VIEW public.project_model_canonical_reconciliation SET (security_invoker = true);
GRANT SELECT ON public.project_model_canonical_reconciliation TO anon, authenticated;
