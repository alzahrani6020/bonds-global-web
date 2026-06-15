-- Bonds V3 — Model Size Variants (Auto-generated)
-- Generated at: 2026-06-13T15:44:08.568Z

BEGIN;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'burger_restaurant_small', 'مطعم برجر صغير', 'Small مطعم برجر',
  'greenfield', 'small', 'SAR',
  300000, 600000, 400000, 800000,
  4, 8, 18,
  ARRAY['food','fast-food'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'burger_restaurant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'burger_restaurant_medium', 'مطعم برجر متوسط', 'Medium مطعم برجر',
  'greenfield', 'medium', 'SAR',
  450000, 900000, 600000, 1200000,
  6, 12, 22,
  ARRAY['food','fast-food'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'burger_restaurant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'burger_restaurant_large', 'مطعم برجر كبير', 'Large مطعم برجر',
  'greenfield', 'large', 'SAR',
  900000, 1800000, 1200000, 2400000,
  12, 24, 25,
  ARRAY['food','fast-food'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'burger_restaurant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'dental_clinic_small', 'عيادة أسنان صغير', 'Small عيادة أسنان',
  'greenfield', 'small', 'SAR',
  800000, 1500000, 600000, 1200000,
  5, 10, 24,
  ARRAY['healthcare','clinic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'dental_clinic'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'dental_clinic_medium', 'عيادة أسنان متوسط', 'Medium عيادة أسنان',
  'greenfield', 'medium', 'SAR',
  1200000, 2250000, 900000, 1800000,
  8, 15, 29,
  ARRAY['healthcare','clinic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'dental_clinic'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'dental_clinic_large', 'عيادة أسنان كبير', 'Large عيادة أسنان',
  'greenfield', 'large', 'SAR',
  2400000, 4500000, 1800000, 3600000,
  15, 30, 34,
  ARRAY['healthcare','clinic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'dental_clinic'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'small_supermarket_small', 'سوبرماركت صغير', 'Small سوبرماركت',
  'greenfield', 'small', 'SAR',
  500000, 1000000, 800000, 1500000,
  3, 6, 20,
  ARRAY['retail','grocery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'small_supermarket'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'small_supermarket_medium', 'سوبرماركت متوسط', 'Medium سوبرماركت',
  'greenfield', 'medium', 'SAR',
  750000, 1500000, 1200000, 2250000,
  5, 9, 24,
  ARRAY['retail','grocery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'small_supermarket'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'small_supermarket_large', 'سوبرماركت كبير', 'Large سوبرماركت',
  'greenfield', 'large', 'SAR',
  1500000, 3000000, 2400000, 4500000,
  9, 18, 28,
  ARRAY['retail','grocery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'small_supermarket'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'plastic_products_factory_small', 'مصنع منتجات بلاستيكية صغير', 'Small مصنع منتجات بلاستيكية',
  'greenfield', 'small', 'SAR',
  2000000, 5000000, 1500000, 4000000,
  10, 25, 36,
  ARRAY['manufacturing','plastic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'plastic_products_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'plastic_products_factory_medium', 'مصنع منتجات بلاستيكية متوسط', 'Medium مصنع منتجات بلاستيكية',
  'greenfield', 'medium', 'SAR',
  3000000, 7500000, 2250000, 6000000,
  15, 38, 43,
  ARRAY['manufacturing','plastic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'plastic_products_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'plastic_products_factory_large', 'مصنع منتجات بلاستيكية كبير', 'Large مصنع منتجات بلاستيكية',
  'greenfield', 'large', 'SAR',
  6000000, 15000000, 4500000, 12000000,
  30, 75, 50,
  ARRAY['manufacturing','plastic'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'plastic_products_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'cold_storage_warehouse_small', 'مستودع تخزين مبرد صغير', 'Small مستودع تخزين مبرد',
  'greenfield', 'small', 'SAR',
  1500000, 3000000, 1000000, 2500000,
  4, 10, 30,
  ARRAY['logistics','cold-storage'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'cold_storage_warehouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'cold_storage_warehouse_medium', 'مستودع تخزين مبرد متوسط', 'Medium مستودع تخزين مبرد',
  'greenfield', 'medium', 'SAR',
  2250000, 4500000, 1500000, 3750000,
  6, 15, 36,
  ARRAY['logistics','cold-storage'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'cold_storage_warehouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'cold_storage_warehouse_large', 'مستودع تخزين مبرد كبير', 'Large مستودع تخزين مبرد',
  'greenfield', 'large', 'SAR',
  4500000, 9000000, 3000000, 7500000,
  12, 30, 42,
  ARRAY['logistics','cold-storage'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'cold_storage_warehouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'kindergarten_small', 'روضة أطفال صغير', 'Small روضة أطفال',
  'greenfield', 'small', 'SAR',
  800000, 1500000, 600000, 1200000,
  8, 15, 30,
  ARRAY['education','children'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'kindergarten'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'kindergarten_medium', 'روضة أطفال متوسط', 'Medium روضة أطفال',
  'greenfield', 'medium', 'SAR',
  1200000, 2250000, 900000, 1800000,
  12, 23, 36,
  ARRAY['education','children'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'kindergarten'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'kindergarten_large', 'روضة أطفال كبير', 'Large روضة أطفال',
  'greenfield', 'large', 'SAR',
  2400000, 4500000, 1800000, 3600000,
  24, 45, 42,
  ARRAY['education','children'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'kindergarten'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'training_center_small', 'مركز تدريب صغير', 'Small مركز تدريب',
  'greenfield', 'small', 'SAR',
  300000, 600000, 400000, 800000,
  4, 8, 18,
  ARRAY['education','training'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'training_center'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'training_center_medium', 'مركز تدريب متوسط', 'Medium مركز تدريب',
  'greenfield', 'medium', 'SAR',
  450000, 900000, 600000, 1200000,
  6, 12, 22,
  ARRAY['education','training'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'training_center'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'training_center_large', 'مركز تدريب كبير', 'Large مركز تدريب',
  'greenfield', 'large', 'SAR',
  900000, 1800000, 1200000, 2400000,
  12, 24, 25,
  ARRAY['education','training'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'training_center'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'residential_contracting_small', 'مقاولات سكنية صغير', 'Small مقاولات سكنية',
  'greenfield', 'small', 'SAR',
  1000000, 3000000, 2000000, 5000000,
  15, 30, 36,
  ARRAY['construction','contracting'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'residential_contracting'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'residential_contracting_medium', 'مقاولات سكنية متوسط', 'Medium مقاولات سكنية',
  'greenfield', 'medium', 'SAR',
  1500000, 4500000, 3000000, 7500000,
  23, 45, 43,
  ARRAY['construction','contracting'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'residential_contracting'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'residential_contracting_large', 'مقاولات سكنية كبير', 'Large مقاولات سكنية',
  'greenfield', 'large', 'SAR',
  3000000, 9000000, 6000000, 15000000,
  45, 90, 50,
  ARRAY['construction','contracting'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'residential_contracting'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'boutique_hotel_small', 'فندق بوتيك صغير', 'Small فندق بوتيك',
  'greenfield', 'small', 'SAR',
  5000000, 10000000, 2000000, 4000000,
  10, 20, 48,
  ARRAY['tourism','hotel'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'boutique_hotel'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'boutique_hotel_medium', 'فندق بوتيك متوسط', 'Medium فندق بوتيك',
  'greenfield', 'medium', 'SAR',
  7500000, 15000000, 3000000, 6000000,
  15, 30, 58,
  ARRAY['tourism','hotel'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'boutique_hotel'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'boutique_hotel_large', 'فندق بوتيك كبير', 'Large فندق بوتيك',
  'greenfield', 'large', 'SAR',
  15000000, 30000000, 6000000, 12000000,
  30, 60, 67,
  ARRAY['tourism','hotel'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'boutique_hotel'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'hajj_umrah_agency_small', 'وكالة حج وعمرة صغير', 'Small وكالة حج وعمرة',
  'greenfield', 'small', 'SAR',
  500000, 1000000, 1000000, 2000000,
  5, 10, 24,
  ARRAY['tourism','hajj'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'hajj_umrah_agency'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'hajj_umrah_agency_medium', 'وكالة حج وعمرة متوسط', 'Medium وكالة حج وعمرة',
  'greenfield', 'medium', 'SAR',
  750000, 1500000, 1500000, 3000000,
  8, 15, 29,
  ARRAY['tourism','hajj'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'hajj_umrah_agency'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'hajj_umrah_agency_large', 'وكالة حج وعمرة كبير', 'Large وكالة حج وعمرة',
  'greenfield', 'large', 'SAR',
  1500000, 3000000, 3000000, 6000000,
  15, 30, 34,
  ARRAY['tourism','hajj'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'hajj_umrah_agency'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'payment_gateway_small', 'بوابة دفع صغير', 'Small بوابة دفع',
  'greenfield', 'small', 'SAR',
  1500000, 3000000, 800000, 1500000,
  8, 15, 36,
  ARRAY['fintech','payments'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'payment_gateway'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'payment_gateway_medium', 'بوابة دفع متوسط', 'Medium بوابة دفع',
  'greenfield', 'medium', 'SAR',
  2250000, 4500000, 1200000, 2250000,
  12, 23, 43,
  ARRAY['fintech','payments'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'payment_gateway'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'payment_gateway_large', 'بوابة دفع كبير', 'Large بوابة دفع',
  'greenfield', 'large', 'SAR',
  4500000, 9000000, 2400000, 4500000,
  24, 45, 50,
  ARRAY['fintech','payments'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'payment_gateway'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'crowdfunding_platform_small', 'منصة تمويل جماعي صغير', 'Small منصة تمويل جماعي',
  'greenfield', 'small', 'SAR',
  1000000, 2000000, 500000, 1000000,
  5, 10, 30,
  ARRAY['fintech','crowdfunding'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'crowdfunding_platform'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'crowdfunding_platform_medium', 'منصة تمويل جماعي متوسط', 'Medium منصة تمويل جماعي',
  'greenfield', 'medium', 'SAR',
  1500000, 3000000, 750000, 1500000,
  8, 15, 36,
  ARRAY['fintech','crowdfunding'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'crowdfunding_platform'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'crowdfunding_platform_large', 'منصة تمويل جماعي كبير', 'Large منصة تمويل جماعي',
  'greenfield', 'large', 'SAR',
  3000000, 6000000, 1500000, 3000000,
  15, 30, 42,
  ARRAY['fintech','crowdfunding'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'crowdfunding_platform'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'vegetable_greenhouse_small', 'بيthouse خضروات صغير', 'Small بيthouse خضروات',
  'greenfield', 'small', 'SAR',
  1000000, 2500000, 800000, 1800000,
  6, 12, 30,
  ARRAY['agriculture','greenhouse'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'vegetable_greenhouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'vegetable_greenhouse_medium', 'بيthouse خضروات متوسط', 'Medium بيthouse خضروات',
  'greenfield', 'medium', 'SAR',
  1500000, 3750000, 1200000, 2700000,
  9, 18, 36,
  ARRAY['agriculture','greenhouse'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'vegetable_greenhouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'vegetable_greenhouse_large', 'بيthouse خضروات كبير', 'Large بيthouse خضروات',
  'greenfield', 'large', 'SAR',
  3000000, 7500000, 2400000, 5400000,
  18, 36, 42,
  ARRAY['agriculture','greenhouse'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'vegetable_greenhouse'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'coffee_shop_small', 'مقهى صغير', 'Small مقهى',
  'greenfield', 'small', 'SAR',
  250000, 500000, 350000, 700000,
  3, 6, 20,
  ARRAY['food','cafe'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'coffee_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'coffee_shop_medium', 'مقهى متوسط', 'Medium مقهى',
  'greenfield', 'medium', 'SAR',
  375000, 750000, 525000, 1050000,
  5, 9, 24,
  ARRAY['food','cafe'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'coffee_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'coffee_shop_large', 'مقهى كبير', 'Large مقهى',
  'greenfield', 'large', 'SAR',
  750000, 1500000, 1050000, 2100000,
  9, 18, 28,
  ARRAY['food','cafe'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'coffee_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'bakery_small', 'مخبز صغير', 'Small مخبز',
  'greenfield', 'small', 'SAR',
  200000, 400000, 300000, 600000,
  3, 5, 18,
  ARRAY['food','bakery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'bakery'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'bakery_medium', 'مخبز متوسط', 'Medium مخبز',
  'greenfield', 'medium', 'SAR',
  300000, 600000, 450000, 900000,
  5, 8, 22,
  ARRAY['food','bakery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'bakery'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'bakery_large', 'مخبز كبير', 'Large مخبز',
  'greenfield', 'large', 'SAR',
  600000, 1200000, 900000, 1800000,
  9, 15, 25,
  ARRAY['food','bakery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'bakery'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'food_truck_small', 'عربة طعام صغير', 'Small عربة طعام',
  'greenfield', 'small', 'SAR',
  100000, 200000, 200000, 400000,
  2, 4, 14,
  ARRAY['food','food-truck'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'food_truck'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'food_truck_medium', 'عربة طعام متوسط', 'Medium عربة طعام',
  'greenfield', 'medium', 'SAR',
  150000, 300000, 300000, 600000,
  3, 6, 17,
  ARRAY['food','food-truck'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'food_truck'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'food_truck_large', 'عربة طعام كبير', 'Large عربة طعام',
  'greenfield', 'large', 'SAR',
  300000, 600000, 600000, 1200000,
  6, 12, 20,
  ARRAY['food','food-truck'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'food_truck'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'pharmacy_small', 'صيدلية صغير', 'Small صيدلية',
  'greenfield', 'small', 'SAR',
  400000, 800000, 500000, 1000000,
  2, 4, 22,
  ARRAY['healthcare','pharmacy'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'pharmacy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'pharmacy_medium', 'صيدلية متوسط', 'Medium صيدلية',
  'greenfield', 'medium', 'SAR',
  600000, 1200000, 750000, 1500000,
  3, 6, 26,
  ARRAY['healthcare','pharmacy'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'pharmacy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'pharmacy_large', 'صيدلية كبير', 'Large صيدلية',
  'greenfield', 'large', 'SAR',
  1200000, 2400000, 1500000, 3000000,
  6, 12, 31,
  ARRAY['healthcare','pharmacy'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'pharmacy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'medical_lab_small', 'مختبر طبي صغير', 'Small مختبر طبي',
  'greenfield', 'small', 'SAR',
  700000, 1400000, 600000, 1200000,
  4, 8, 26,
  ARRAY['healthcare','lab'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'medical_lab'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'medical_lab_medium', 'مختبر طبي متوسط', 'Medium مختبر طبي',
  'greenfield', 'medium', 'SAR',
  1050000, 2100000, 900000, 1800000,
  6, 12, 31,
  ARRAY['healthcare','lab'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'medical_lab'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'medical_lab_large', 'مختبر طبي كبير', 'Large مختبر طبي',
  'greenfield', 'large', 'SAR',
  2100000, 4200000, 1800000, 3600000,
  12, 24, 36,
  ARRAY['healthcare','lab'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'medical_lab'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'mobile_shop_small', 'محل جوالات صغير', 'Small محل جوالات',
  'greenfield', 'small', 'SAR',
  300000, 600000, 600000, 1200000,
  2, 4, 20,
  ARRAY['retail','electronics'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'mobile_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'mobile_shop_medium', 'محل جوالات متوسط', 'Medium محل جوالات',
  'greenfield', 'medium', 'SAR',
  450000, 900000, 900000, 1800000,
  3, 6, 24,
  ARRAY['retail','electronics'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'mobile_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'mobile_shop_large', 'محل جوالات كبير', 'Large محل جوالات',
  'greenfield', 'large', 'SAR',
  900000, 1800000, 1800000, 3600000,
  6, 12, 28,
  ARRAY['retail','electronics'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'mobile_shop'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'clothing_store_small', 'محل ملابس صغير', 'Small محل ملابس',
  'greenfield', 'small', 'SAR',
  350000, 700000, 500000, 1000000,
  2, 5, 22,
  ARRAY['retail','fashion'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'clothing_store'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'clothing_store_medium', 'محل ملابس متوسط', 'Medium محل ملابس',
  'greenfield', 'medium', 'SAR',
  525000, 1050000, 750000, 1500000,
  3, 8, 26,
  ARRAY['retail','fashion'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'clothing_store'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'clothing_store_large', 'محل ملابس كبير', 'Large محل ملابس',
  'greenfield', 'large', 'SAR',
  1050000, 2100000, 1500000, 3000000,
  6, 15, 31,
  ARRAY['retail','fashion'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'clothing_store'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'water_bottling_plant_small', 'مصنع تعبئة مياه صغير', 'Small مصنع تعبئة مياه',
  'greenfield', 'small', 'SAR',
  2000000, 4000000, 1500000, 3000000,
  10, 20, 36,
  ARRAY['manufacturing','water'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'water_bottling_plant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'water_bottling_plant_medium', 'مصنع تعبئة مياه متوسط', 'Medium مصنع تعبئة مياه',
  'greenfield', 'medium', 'SAR',
  3000000, 6000000, 2250000, 4500000,
  15, 30, 43,
  ARRAY['manufacturing','water'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'water_bottling_plant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'water_bottling_plant_large', 'مصنع تعبئة مياه كبير', 'Large مصنع تعبئة مياه',
  'greenfield', 'large', 'SAR',
  6000000, 12000000, 4500000, 9000000,
  30, 60, 50,
  ARRAY['manufacturing','water'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'water_bottling_plant'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'packaging_factory_small', 'مصنع تعبئة وتغليف صغير', 'Small مصنع تعبئة وتغليف',
  'greenfield', 'small', 'SAR',
  1500000, 3000000, 1200000, 2500000,
  8, 15, 30,
  ARRAY['manufacturing','packaging'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'packaging_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'packaging_factory_medium', 'مصنع تعبئة وتغليف متوسط', 'Medium مصنع تعبئة وتغليف',
  'greenfield', 'medium', 'SAR',
  2250000, 4500000, 1800000, 3750000,
  12, 23, 36,
  ARRAY['manufacturing','packaging'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'packaging_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'packaging_factory_large', 'مصنع تعبئة وتغليف كبير', 'Large مصنع تعبئة وتغليف',
  'greenfield', 'large', 'SAR',
  4500000, 9000000, 3600000, 7500000,
  24, 45, 42,
  ARRAY['manufacturing','packaging'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'packaging_factory'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'last_mile_delivery_small', 'توصيل لمسافة قصيرة صغير', 'Small توصيل لمسافة قصيرة',
  'greenfield', 'small', 'SAR',
  400000, 800000, 800000, 1500000,
  6, 12, 24,
  ARRAY['logistics','delivery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'last_mile_delivery'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'last_mile_delivery_medium', 'توصيل لمسافة قصيرة متوسط', 'Medium توصيل لمسافة قصيرة',
  'greenfield', 'medium', 'SAR',
  600000, 1200000, 1200000, 2250000,
  9, 18, 29,
  ARRAY['logistics','delivery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'last_mile_delivery'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'last_mile_delivery_large', 'توصيل لمسافة قصيرة كبير', 'Large توصيل لمسافة قصيرة',
  'greenfield', 'large', 'SAR',
  1200000, 2400000, 2400000, 4500000,
  18, 36, 34,
  ARRAY['logistics','delivery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'last_mile_delivery'
ON CONFLICT (code) DO NOTHING;

-- Link all published models to default assumptions and risks
INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT pm.id, fa.id, fa.default_value
FROM public.project_models pm
CROSS JOIN public.financial_assumptions fa
WHERE pm.is_published = true
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT pm.id, rf.id, rf.default_score, 'Initial default risk score'
FROM public.project_models pm
CROSS JOIN public.risk_factors rf
WHERE pm.is_published = true
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

COMMIT;
