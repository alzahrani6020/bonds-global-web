-- Bonds V3 — Additional Project Models (Auto-generated)
-- Generated at: 2026-06-13T13:20:22.088Z

BEGIN;

-- Sectors
INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)
VALUES ('education', 'التعليم', 'Education', 'low', 10)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)
VALUES ('construction', 'البناء والتشييد', 'Construction', 'high', 10)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)
VALUES ('tourism', 'السياحة والسفر', 'Tourism & Travel', 'medium', 10)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)
VALUES ('fintech', 'التقنية المالية', 'Fintech', 'medium', 10)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sectors (code, name_ar, name_en, risk_category, sort_order)
VALUES ('agriculture', 'الزراعة', 'Agriculture', 'medium', 10)
ON CONFLICT (code) DO NOTHING;

-- Sub-sectors
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'private_schools', 'المدارس والمراكز الخاصة', 'Private Schools & Centers', 1
FROM public.economic_sectors s WHERE s.code = 'education'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'building_contracting', 'المقاولات العامة', 'General Contracting', 1
FROM public.economic_sectors s WHERE s.code = 'construction'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'hotels', 'الفنادق والضيافة', 'Hotels & Hospitality', 1
FROM public.economic_sectors s WHERE s.code = 'tourism'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'travel_agencies', 'وكالات السفر', 'Travel Agencies', 1
FROM public.economic_sectors s WHERE s.code = 'tourism'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'payment_solutions', 'حلول الدفع', 'Payment Solutions', 1
FROM public.economic_sectors s WHERE s.code = 'fintech'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'crowdfunding', 'التمويل الجماعي', 'Crowdfunding', 1
FROM public.economic_sectors s WHERE s.code = 'fintech'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'greenhouses', 'البيوت المحمية', 'Greenhouses', 1
FROM public.economic_sectors s WHERE s.code = 'agriculture'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'cafes', 'المقاهي', 'Cafes', 1
FROM public.economic_sectors s WHERE s.code = 'food_services'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'bakeries', 'المخابز', 'Bakeries', 1
FROM public.economic_sectors s WHERE s.code = 'food_services'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'food_trucks', 'عربات الطعام', 'Food Trucks', 1
FROM public.economic_sectors s WHERE s.code = 'food_services'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'pharmacies', 'الصيدليات', 'Pharmacies', 1
FROM public.economic_sectors s WHERE s.code = 'healthcare'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'medical_labs', 'المختبرات الطبية', 'Medical Labs', 1
FROM public.economic_sectors s WHERE s.code = 'healthcare'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'electronics', 'الإلكترونيات', 'Electronics', 1
FROM public.economic_sectors s WHERE s.code = 'retail_trade'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'fashion', 'الأزياء', 'Fashion', 1
FROM public.economic_sectors s WHERE s.code = 'retail_trade'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'food_processing', 'تصنيع الأغذية', 'Food Processing', 1
FROM public.economic_sectors s WHERE s.code = 'light_manufacturing'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'packaging', 'تصنيع التعبئة والتغليف', 'Packaging Manufacturing', 1
FROM public.economic_sectors s WHERE s.code = 'light_manufacturing'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'delivery', 'خدمات التوصيل', 'Delivery Services', 1
FROM public.economic_sectors s WHERE s.code = 'logistics_services'
ON CONFLICT (code) DO NOTHING;

-- Activities
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'kindergarten', 'روضة أطفال', 'Kindergarten', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'private_schools'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'training_center', 'مركز تدريب', 'Training Center', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'private_schools'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'residential_contracting', 'مقاولات سكنية', 'Residential Contracting', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'building_contracting'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'boutique_hotel', 'فندق بوتيك', 'Boutique Hotel', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'hotels'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'hajj_umrah_agency', 'وكالة حج وعمرة', 'Hajj & Umrah Agency', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'travel_agencies'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'payment_gateway', 'بوابة دفع', 'Payment Gateway', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'payment_solutions'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'crowdfunding_platform', 'منصة تمويل جماعي', 'Crowdfunding Platform', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'crowdfunding'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'vegetable_greenhouse', 'بيthouse خضروات', 'Vegetable Greenhouse', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'greenhouses'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'coffee_shop', 'مقهى', 'Coffee Shop', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'cafes'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'bakery', 'مخبز', 'Bakery', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'bakeries'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'food_truck', 'عربة طعام', 'Food Truck', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'food_trucks'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'pharmacy', 'صيدلية', 'Pharmacy', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'pharmacies'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'medical_lab', 'مختبر طبي', 'Medical Lab', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'medical_labs'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'mobile_shop', 'محل جوالات', 'Mobile Shop', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'electronics'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'clothing_store', 'محل ملابس', 'Clothing Store', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'fashion'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'water_bottling_plant', 'مصنع تعبئة مياه', 'Water Bottling Plant', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'food_processing'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'packaging_factory', 'مصنع تعبئة وتغليف', 'Packaging Factory', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'packaging'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, ss.id, 'last_mile_delivery', 'توصيل لمسافة قصيرة', 'Last Mile Delivery', 1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
WHERE ss.code = 'delivery'
ON CONFLICT (code) DO NOTHING;

-- Project models
INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'small_kindergarten', 'روضة أطفال صغيرة', 'Small Kindergarten',
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
  'small_training_center', 'مركز تدريب صغير', 'Small Training Center',
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
  'small_contracting_company', 'شركة مقاولات صغيرة', 'Small Contracting Company',
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
  'small_boutique_hotel', 'فندق بوتيك صغير', 'Small Boutique Hotel',
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
  'small_hajj_agency', 'وكالة حج وعمرة صغيرة', 'Small Hajj & Umrah Agency',
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
  'small_payment_gateway', 'بوابة دفع صغيرة', 'Small Payment Gateway',
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
  'small_crowdfunding_platform', 'منصة تمويل جماعي صغيرة', 'Small Crowdfunding Platform',
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
  'medium_vegetable_greenhouse', 'بيthouse خضروات متوسط', 'Medium Vegetable Greenhouse',
  'greenfield', 'medium', 'SAR',
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
  'small_coffee_shop', 'مقهى صغير', 'Small Coffee Shop',
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
  'small_bakery', 'مخبز صغير', 'Small Bakery',
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
  'food_truck', 'عربة طعام', 'Food Truck',
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
  'small_pharmacy', 'صيدلية صغيرة', 'Small Pharmacy',
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
  'small_medical_lab', 'مختبر طبي صغير', 'Small Medical Lab',
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
  'small_mobile_shop', 'محل جوالات صغير', 'Small Mobile Shop',
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
  'small_clothing_store', 'محل ملابس صغير', 'Small Clothing Store',
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
  'small_water_bottling_plant', 'مصنع تعبئة مياه صغير', 'Small Water Bottling Plant',
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
  'small_packaging_factory', 'مصنع تعبئة وتغليف صغير', 'Small Packaging Factory',
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
  'small_last_mile_delivery', 'شركة توصيل لمسافة قصيرة', 'Small Last Mile Delivery',
  'greenfield', 'small', 'SAR',
  400000, 800000, 800000, 1500000,
  6, 12, 24,
  ARRAY['logistics','delivery'], true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.sector_id = s.id
JOIN public.economic_activities a ON a.sub_sector_id = ss.id
WHERE a.code = 'last_mile_delivery'
ON CONFLICT (code) DO NOTHING;

-- Link all published models to all assumptions
INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT pm.id, fa.id, fa.default_value
FROM public.project_models pm
CROSS JOIN public.financial_assumptions fa
WHERE pm.is_published = true
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

-- Link all published models to all risk factors
INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT pm.id, rf.id, rf.default_score, 'Initial default risk score'
FROM public.project_models pm
CROSS JOIN public.risk_factors rf
WHERE pm.is_published = true
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

COMMIT;
