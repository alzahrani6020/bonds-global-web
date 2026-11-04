-- Calibrate published project-model financials from Bonds internal benchmarks.
-- Sources: v3/engine/data-acquisition/benchmarks/pricing.json
-- and v3/engine/data-acquisition/benchmarks/market.json
-- via BenchmarkAdapter.getActivityCategory. Size multipliers match
-- v3/scripts/generate-model-variants.js (small 1 / medium 1.5 / large 3).
-- Clone size bases match v3/scripts/generate-master-data.js SIZE_PROFILES.
-- Dental clinic models keep their existing specialized ranges.
-- Specialty clinics scale the documented dental ranges by
-- medical_clinic.equipment_cost_avg / dental_clinics.equipment_cost_avg.
-- These are internal Bonds benchmarks, not official sector statistics.

WITH factors (
  activity_code, category, capex_factor, revenue_factor,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  construction_cost_per_sqm
) AS (
  VALUES
    ('assembly', 'industrial', 5.000000, 1.250000, 200000, 600000, 1500000, 50000, 100000, 200000, 1500),
    ('banking_services', 'financial', 1.166667, 1.250000, 50000, 140000, 320000, 20000, 40000, 80000, 1800),
    ('beauty', 'beauty', 1.083333, 1.333333, 60000, 130000, 260000, 18000, 32000, 60000, 2400),
    ('cafe', 'cafe', 1.333333, 1.500000, 80000, 160000, 320000, 22000, 40000, 75000, 2600),
    ('catering', 'fast_food', 1.500000, 2.000000, 100000, 180000, 350000, 25000, 45000, 85000, 2400),
    ('cleaning_services', 'facility_services', 0.583333, 0.583333, 25000, 70000, 160000, 12000, 22000, 40000, 800),
    ('commercial', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('consulting', 'consulting', 0.500000, 0.750000, 20000, 60000, 140000, 12000, 25000, 50000, 1400),
    ('dental_clinic', 'medical_clinic', 2.916667, 0.750000, 180000, 350000, 700000, 35000, 60000, 110000, 3000),
    ('dermatology_clinics', 'medical_clinic', 2.916667, 0.750000, 180000, 350000, 700000, 35000, 60000, 110000, 3000),
    ('digital_transformation', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('distribution', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('e_commerce', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('e_learning', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('energy_efficiency', 'energy', 12.500000, 1.666667, 500000, 1500000, 4000000, 80000, 180000, 350000, 2500),
    ('events', 'tourism', 1.666667, 2.000000, 80000, 200000, 450000, 25000, 50000, 95000, 2400),
    ('facilities_management', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('factories', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('farming', 'agriculture', 0.916667, 0.500000, 40000, 110000, 250000, 12000, 24000, 45000, 600),
    ('fast_food', 'fast_food', 1.500000, 2.000000, 100000, 180000, 350000, 25000, 45000, 85000, 2400),
    ('fintech', 'financial', 1.166667, 1.250000, 50000, 140000, 320000, 20000, 40000, 80000, 1800),
    ('government_consulting', 'consulting', 0.500000, 0.750000, 20000, 60000, 140000, 12000, 25000, 50000, 1400),
    ('gym', 'gym', 2.083333, 1.166667, 120000, 250000, 500000, 20000, 38000, 70000, 2200),
    ('hardware', 'technology_hardware', 1.333333, 1.500000, 60000, 160000, 350000, 18000, 35000, 65000, 1200),
    ('import_export', 'wholesale', 0.833333, 2.500000, 40000, 100000, 220000, 18000, 32000, 55000, 1200),
    ('industrial', 'industrial', 5.000000, 1.250000, 200000, 600000, 1500000, 50000, 100000, 200000, 1500),
    ('insurance', 'financial', 1.166667, 1.250000, 50000, 140000, 320000, 20000, 40000, 80000, 1800),
    ('investment', 'financial', 1.166667, 1.250000, 50000, 140000, 320000, 20000, 40000, 80000, 1800),
    ('it_services', 'technology', 0.750000, 1.000000, 30000, 90000, 200000, 15000, 30000, 60000, 1000),
    ('last_mile_delivery_ac58d00b', 'logistics', 1.833333, 1.500000, 80000, 220000, 500000, 25000, 50000, 95000, 1000),
    ('livestock', 'agriculture', 0.916667, 0.500000, 40000, 110000, 250000, 12000, 24000, 45000, 600),
    ('maintenance', 'facility_services', 0.583333, 0.583333, 25000, 70000, 160000, 12000, 22000, 40000, 800),
    ('media', 'tourism', 1.666667, 2.000000, 80000, 200000, 450000, 25000, 50000, 95000, 2400),
    ('oil_gas', 'energy', 12.500000, 1.666667, 500000, 1500000, 4000000, 80000, 180000, 350000, 2500),
    ('ophthalmology_clinics', 'medical_clinic', 2.916667, 0.750000, 180000, 350000, 700000, 35000, 60000, 110000, 3000),
    ('packaging', 'industrial', 5.000000, 1.250000, 200000, 600000, 1500000, 50000, 100000, 200000, 1500),
    ('pediatric_clinics', 'medical_clinic', 2.916667, 0.750000, 180000, 350000, 700000, 35000, 60000, 110000, 3000),
    ('processing', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('real_estate_brokerage', 'real_estate', 0.666667, 2.083333, 30000, 80000, 180000, 15000, 28000, 50000, 1200),
    ('renewable_energy', 'energy', 12.500000, 1.666667, 500000, 1500000, 4000000, 80000, 180000, 350000, 2500),
    ('residential', 'real_estate', 0.666667, 2.083333, 30000, 80000, 180000, 15000, 28000, 50000, 1200),
    ('restaurant', 'restaurant', 2.500000, 3.500000, 150000, 300000, 600000, 35000, 65000, 120000, 3200),
    ('retail_de6eadad', 'retail', 1.166667, 5.416667, 60000, 140000, 300000, 20000, 38000, 70000, 2200),
    ('schools', 'education', 1.000000, 1.833333, 50000, 120000, 250000, 22000, 40000, 75000, 1800),
    ('security_services', 'facility_services', 0.583333, 0.583333, 25000, 70000, 160000, 12000, 22000, 40000, 800),
    ('shipping', 'logistics', 1.833333, 1.500000, 80000, 220000, 500000, 25000, 50000, 95000, 1000),
    ('software', 'technology', 0.750000, 1.000000, 30000, 90000, 200000, 15000, 30000, 60000, 1000),
    ('sports', 'gym', 2.083333, 1.166667, 120000, 250000, 500000, 20000, 38000, 70000, 2200),
    ('telecommunications', 'technology_hardware', 1.333333, 1.500000, 60000, 160000, 350000, 18000, 35000, 65000, 1200),
    ('tourism', 'tourism', 1.666667, 2.000000, 80000, 200000, 450000, 25000, 50000, 95000, 2400),
    ('training_center', 'education', 1.000000, 1.833333, 50000, 120000, 250000, 22000, 40000, 75000, 1800),
    ('transport', 'logistics', 1.833333, 1.500000, 80000, 220000, 500000, 25000, 50000, 95000, 1000),
    ('universities', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('utilities', 'energy', 12.500000, 1.666667, 500000, 1500000, 4000000, 80000, 180000, 350000, 2500),
    ('warehousing', 'default', 1.000000, 1.000000, 50000, 120000, 250000, 15000, 30000, 60000, 2000),
    ('wholesale', 'wholesale', 0.833333, 2.500000, 40000, 100000, 220000, 18000, 32000, 55000, 1200),
    ('workshops', 'industrial', 5.000000, 1.250000, 200000, 600000, 1500000, 50000, 100000, 200000, 1500)
),
size_mult (size_category, mult) AS (
  VALUES ('small'::text, 1.0), ('medium'::text, 1.5), ('large'::text, 3.0)
)
UPDATE public.project_models pm
SET
  capex_min = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 100000 WHEN 'medium' THEN 400000 ELSE 1500000 END
    * f.capex_factor
  )::numeric / 1000) * 1000),
  capex_max = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 300000 WHEN 'medium' THEN 1000000 ELSE 5000000 END
    * f.capex_factor
  )::numeric / 1000) * 1000),
  revenue_min = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 200000 WHEN 'medium' THEN 800000 ELSE 2500000 END
    * f.revenue_factor
  )::numeric / 1000) * 1000),
  revenue_max = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 500000 WHEN 'medium' THEN 2000000 ELSE 8000000 END
    * f.revenue_factor
  )::numeric / 1000) * 1000),
  construction_cost_per_sqm = f.construction_cost_per_sqm,
  equipment_cost_min = ROUND(f.equipment_cost_min * sm.mult),
  equipment_cost_avg = ROUND(f.equipment_cost_avg * sm.mult),
  equipment_cost_max = ROUND(f.equipment_cost_max * sm.mult),
  monthly_operation_cost_min = ROUND(f.monthly_operation_cost_min * sm.mult),
  monthly_operation_cost_avg = ROUND(f.monthly_operation_cost_avg * sm.mult),
  monthly_operation_cost_max = ROUND(f.monthly_operation_cost_max * sm.mult),
  description = 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  tags = CASE
    WHEN pm.tags IS NULL THEN ARRAY['bonds_benchmark_v1']
    WHEN 'bonds_benchmark_v1' = ANY(pm.tags) THEN pm.tags
    ELSE pm.tags || ARRAY['bonds_benchmark_v1']
  END,
  updated_at = NOW()
FROM public.project_model_canonical_reconciliation r
JOIN public.canonical_activities ca ON ca.id = r.canonical_activity_id
JOIN factors f ON f.activity_code = ca.code
CROSS JOIN size_mult sm
WHERE pm.id = r.id
  AND sm.size_category = pm.size_category
  AND r.is_published IS TRUE
  AND r.is_active IS TRUE
  AND r.mapping_status = 'mapped'
  AND pm.size_category IN ('small', 'medium', 'large')
  AND pm.code NOT IN ('small_dental_clinic_model', 'medium_dental_clinic_model', 'large_dental_clinic_model', 'beauty_small_model', 'beauty_medium_model', 'beauty_large_model', 'gym_small_model', 'gym_medium_model', 'gym_large_model', 'dermatology_clinics_small_model', 'dermatology_clinics_medium_model', 'dermatology_clinics_large_model', 'ophthalmology_clinics_small_model', 'ophthalmology_clinics_medium_model', 'ophthalmology_clinics_large_model', 'pediatric_clinics_small_model', 'pediatric_clinics_medium_model', 'pediatric_clinics_large_model');

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'beauty_small_model', 'نموذج صالونات تجميل — الاقتصاد الإبداعي (صغير)', 'Small Creative Economy Beauty Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'small', 'SAR',
  108000, 325000, 267000, 667000,
  2, 5, 18,
  2400,
  60000, 130000, 260000,
  18000, 32000, 60000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'beauty'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_small_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'beauty_small_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_small_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'beauty_small_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'beauty_medium_model', 'نموذج صالونات تجميل — الاقتصاد الإبداعي (متوسط)', 'Medium Creative Economy Beauty Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'medium', 'SAR',
  433000, 1083000, 1067000, 2667000,
  6, 15, 24,
  2400,
  90000, 195000, 390000,
  27000, 48000, 90000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'beauty'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_medium_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'beauty_medium_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_medium_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'beauty_medium_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'beauty_large_model', 'نموذج صالونات تجميل — الاقتصاد الإبداعي (كبير)', 'Large Creative Economy Beauty Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'large', 'SAR',
  1625000, 5417000, 3333000, 10667000,
  16, 40, 36,
  2400,
  180000, 390000, 780000,
  54000, 96000, 180000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'beauty'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_large_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'beauty_large_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_large_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'beauty_large_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'gym_small_model', 'نموذج صالات رياضية — الترفيه والرياضة (صغير)', 'Small Entertainment & Sports Gym Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'small', 'SAR',
  208000, 625000, 233000, 583000,
  2, 5, 18,
  2200,
  120000, 250000, 500000,
  20000, 38000, 70000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'gym'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_small_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'gym_small_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_small_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'gym_small_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'gym_medium_model', 'نموذج صالات رياضية — الترفيه والرياضة (متوسط)', 'Medium Entertainment & Sports Gym Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'medium', 'SAR',
  833000, 2083000, 933000, 2333000,
  6, 15, 24,
  2200,
  180000, 375000, 750000,
  30000, 57000, 105000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'gym'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_medium_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'gym_medium_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_medium_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'gym_medium_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'gym_large_model', 'نموذج صالات رياضية — الترفيه والرياضة (كبير)', 'Large Entertainment & Sports Gym Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'large', 'SAR',
  3125000, 10417000, 2917000, 9333000,
  16, 40, 36,
  2200,
  360000, 750000, 1500000,
  60000, 114000, 210000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'gym'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_large_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'gym_large_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'advertising_cleaning_activity_large_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'gym_large_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'dermatology_clinics_small_model', 'نموذج عيادات الجلدية — الصحة (صغير)', 'Small Health Dermatology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'small', 'SAR',
  175000, 315000, 280000, 490000,
  2, 4, 18,
  3000,
  180000, 350000, 700000,
  35000, 60000, 110000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'dermatology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_small_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_small_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'dermatology_clinics_medium_model', 'نموذج عيادات الجلدية — الصحة (متوسط)', 'Medium Health Dermatology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'medium', 'SAR',
  420000, 840000, 700000, 1400000,
  5, 10, 24,
  3000,
  270000, 525000, 1050000,
  52500, 90000, 165000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'dermatology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_medium_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_medium_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'dermatology_clinics_large_model', 'نموذج عيادات الجلدية — الصحة (كبير)', 'Large Health Dermatology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'large', 'SAR',
  1050000, 2100000, 1750000, 3500000,
  12, 25, 36,
  3000,
  540000, 1050000, 2100000,
  105000, 180000, 330000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'dermatology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_large_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'dermatology_clinics_large_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'ophthalmology_clinics_small_model', 'نموذج عيادات العيون — الصحة (صغير)', 'Small Health Ophthalmology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'small', 'SAR',
  175000, 315000, 280000, 490000,
  2, 4, 18,
  3000,
  180000, 350000, 700000,
  35000, 60000, 110000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'ophthalmology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_small_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_small_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'ophthalmology_clinics_medium_model', 'نموذج عيادات العيون — الصحة (متوسط)', 'Medium Health Ophthalmology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'medium', 'SAR',
  420000, 840000, 700000, 1400000,
  5, 10, 24,
  3000,
  270000, 525000, 1050000,
  52500, 90000, 165000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'ophthalmology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_medium_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_medium_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'ophthalmology_clinics_large_model', 'نموذج عيادات العيون — الصحة (كبير)', 'Large Health Ophthalmology Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'large', 'SAR',
  1050000, 2100000, 1750000, 3500000,
  12, 25, 36,
  3000,
  540000, 1050000, 2100000,
  105000, 180000, 330000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'ophthalmology_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_large_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'ophthalmology_clinics_large_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'pediatric_clinics_small_model', 'نموذج عيادات الأطفال — الصحة (صغير)', 'Small Health Pediatric Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'small', 'SAR',
  175000, 315000, 280000, 490000,
  2, 4, 18,
  3000,
  180000, 350000, 700000,
  35000, 60000, 110000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'pediatric_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_small_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'small_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_small_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'pediatric_clinics_medium_model', 'نموذج عيادات الأطفال — الصحة (متوسط)', 'Medium Health Pediatric Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'medium', 'SAR',
  420000, 840000, 700000, 1400000,
  5, 10, 24,
  3000,
  270000, 525000, 1050000,
  52500, 90000, 165000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'pediatric_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_medium_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'medium_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_medium_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  'pediatric_clinics_large_model', 'نموذج عيادات الأطفال — الصحة (كبير)', 'Large Health Pediatric Clinics Model', 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  'greenfield', 'large', 'SAR',
  1050000, 2100000, 1750000, 3500000,
  12, 25, 36,
  3000,
  540000, 1050000, 2100000,
  105000, 180000, 330000,
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = 'pediatric_clinics'
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_large_model'
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = 'large_dental_clinic_model'
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = 'pediatric_clinics_large_model'
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;
