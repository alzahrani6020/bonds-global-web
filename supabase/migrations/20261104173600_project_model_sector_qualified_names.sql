-- Qualify colliding project-model display names with the already-mapped
-- investment sector, canonical activity and size labels.
-- Financial figures are not rewritten. Unique names (dental clinics) stay.

UPDATE public.project_models pm
SET
  name_ar = concat('نموذج ', ca.name_ar, ' — ', s.name_ar, ' (', sz.name_ar, ')'),
  name_en = concat(sz.name_en, ' ', s.name_en, ' ', ca.name_en, ' Model'),
  updated_at = NOW()
FROM public.project_model_canonical_reconciliation r
JOIN public.canonical_activities ca
  ON ca.id = r.canonical_activity_id
JOIN public.canonical_investment_sectors s
  ON s.id = r.investment_sector_id
JOIN public.investment_project_sizes sz
  ON sz.code = r.size_category
WHERE pm.id = r.id
  AND r.is_published IS TRUE
  AND r.is_active IS TRUE
  AND r.mapping_status = 'mapped'
  AND pm.name_ar NOT LIKE '% — %'
  AND (
    pm.name_ar IN (
      SELECT name_ar
      FROM public.project_models
      WHERE is_published IS TRUE AND is_active IS TRUE
      GROUP BY name_ar
      HAVING COUNT(*) > 1
    )
    OR pm.name_en IN (
      SELECT name_en
      FROM public.project_models
      WHERE is_published IS TRUE AND is_active IS TRUE
      GROUP BY name_en
      HAVING COUNT(*) > 1
    )
  );

-- Remaining collisions share one investment sector across several legacy
-- economic sectors. Qualify those titles with the legacy sector name.
UPDATE public.project_models pm
SET
  name_ar = concat('نموذج ', ca.name_ar, ' — ', es.name_ar, ' (', sz.name_ar, ')'),
  name_en = concat(sz.name_en, ' ', es.name_en, ' ', ca.name_en, ' Model'),
  updated_at = NOW()
FROM public.project_model_canonical_reconciliation r
JOIN public.canonical_activities ca
  ON ca.id = r.canonical_activity_id
JOIN public.economic_sectors es
  ON es.id = r.legacy_sector_id
JOIN public.investment_project_sizes sz
  ON sz.code = r.size_category
WHERE pm.id = r.id
  AND r.is_published IS TRUE
  AND r.is_active IS TRUE
  AND r.mapping_status = 'mapped'
  AND (
    pm.name_ar IN (
      SELECT name_ar
      FROM public.project_models
      WHERE is_published IS TRUE AND is_active IS TRUE
      GROUP BY name_ar
      HAVING COUNT(*) > 1
    )
    OR pm.name_en IN (
      SELECT name_en
      FROM public.project_models
      WHERE is_published IS TRUE AND is_active IS TRUE
      GROUP BY name_en
      HAVING COUNT(*) > 1
    )
  );
