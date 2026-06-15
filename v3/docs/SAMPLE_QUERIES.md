# Bonds V3 — Sample Queries

> استعلامات SQL نموذجية يمكن استخدامها في APIs أو التقارير.

## 1. جلب القطاعات مع الأنشطة التابعة لها

```sql
SELECT
  s.id AS sector_id,
  s.name_ar AS sector_name,
  ss.id AS sub_sector_id,
  ss.name_ar AS sub_sector_name,
  a.id AS activity_id,
  a.name_ar AS activity_name
FROM public.economic_sectors s
LEFT JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
LEFT JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE s.is_active = true
ORDER BY s.sort_order, ss.sort_order, a.sort_order;
```

## 2. البحث في نماذج المشاريع

```sql
SELECT *
FROM public.project_models
WHERE is_published = true
  AND is_active = true
  AND (
    name_ar ILIKE '%برجر%'
    OR tags @> ARRAY['food']
  )
ORDER BY name_ar;
```

## 3. جلب نموذج مشروع كامل مع افتراضاته ومخاطره

```sql
SELECT
  pm.*,
  jsonb_agg(DISTINCT jsonb_build_object(
    'code', fa.code,
    'name_ar', fa.name_ar,
    'category', fa.category,
    'unit_type', fa.unit_type,
    'value', pma.value
  )) AS assumptions,
  jsonb_agg(DISTINCT jsonb_build_object(
    'code', rf.code,
    'name_ar', rf.name_ar,
    'category', rf.category,
    'weight', rf.weight,
    'score', pmr.score
  )) AS risks
FROM public.project_models pm
LEFT JOIN public.project_model_assumptions pma ON pma.project_model_id = pm.id
LEFT JOIN public.financial_assumptions fa ON fa.id = pma.assumption_id
LEFT JOIN public.project_model_risks pmr ON pmr.project_model_id = pm.id
LEFT JOIN public.risk_factors rf ON rf.id = pmr.risk_factor_id
WHERE pm.code = 'burger_restaurant_small'
GROUP BY pm.id;
```

## 4. حساب Risk Score المرجّح لنموذج

```sql
SELECT
  pm.name_ar,
  ROUND(
    SUM(pmr.score * rf.weight) / NULLIF(SUM(rf.weight), 0),
    2
  ) AS weighted_risk_score
FROM public.project_models pm
JOIN public.project_model_risks pmr ON pmr.project_model_id = pm.id
JOIN public.risk_factors rf ON rf.id = pmr.risk_factor_id
WHERE pm.code = 'burger_restaurant_small'
GROUP BY pm.id, pm.name_ar;
```

## 5. بيانات السوق لنشاط معين في جميع المدن

```sql
SELECT
  c.name_ar AS city,
  c.population,
  c.purchasing_power_index,
  cmd.competitors_count,
  cmd.avg_rent_per_sqm,
  cmd.avg_salary,
  cmd.labor_availability_score,
  cmd.market_saturation_score
FROM public.city_market_data cmd
JOIN public.cities c ON c.id = cmd.city_id
JOIN public.economic_activities a ON a.id = cmd.activity_id
WHERE a.code = 'burger_restaurant'
  AND cmd.data_year = 2025
ORDER BY c.name_ar;
```

## 6. أفضل مدينة لنشاط بناءً على توازن الدخل والمنافسة

```sql
SELECT
  c.name_ar AS city,
  c.purchasing_power_index,
  cmd.market_saturation_score,
  cmd.avg_rent_per_sqm,
  (c.purchasing_power_index * 0.4
   - cmd.market_saturation_score * 0.3
   - (cmd.avg_rent_per_sqm / 100) * 0.3
  ) AS opportunity_score
FROM public.city_market_data cmd
JOIN public.cities c ON c.id = cmd.city_id
JOIN public.economic_activities a ON a.id = cmd.activity_id
WHERE a.code = 'burger_restaurant'
  AND cmd.data_year = 2025
ORDER BY opportunity_score DESC;
```

## 7. مشاريع مستخدم مع نتائجها

```sql
SELECT
  up.id,
  up.name,
  up.status,
  pm.name_ar AS model_name,
  c.name_ar AS city,
  up.financial_results,
  up.risk_results,
  up.created_at
FROM public.user_projects up
JOIN public.project_models pm ON pm.id = up.project_model_id
LEFT JOIN public.cities c ON c.id = up.city_id
WHERE up.user_id = 'USER_UUID_HERE'
ORDER BY up.created_at DESC;
```
