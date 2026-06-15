-- Bonds V3 Enterprise — Sample Master Data V1
-- 5 sectors, 5 sub-sectors, 5 activities, 5 project models,
-- basic assumptions, risk factors, and sample cities/market data.

BEGIN;

-----------------------------------------------------------------------------
-- 1. Sectors
-----------------------------------------------------------------------------

INSERT INTO public.economic_sectors (code, name_ar, name_en, description, risk_category, sort_order)
VALUES
  ('food_services', 'المطاعم والمأكولات', 'Food Services', 'Restaurants, cafes, fast food, catering', 'medium', 1),
  ('healthcare', 'الرعاية الصحية', 'Healthcare', 'Clinics, medical centers, pharmacies', 'low', 2),
  ('retail_trade', 'التجارة والتجزئة', 'Retail Trade', 'Supermarkets, convenience stores, specialty shops', 'medium', 3),
  ('light_manufacturing', 'التصنيع الخفيف', 'Light Manufacturing', 'Small and medium factories', 'high', 4),
  ('logistics_services', 'الخدمات اللوجستية', 'Logistics Services', 'Warehousing, cold storage, last-mile delivery', 'medium', 5)
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 2. Sub-sectors
-----------------------------------------------------------------------------

INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'quick_service', 'الخدمة السريعة', 'Quick Service Restaurants', 1
FROM public.economic_sectors s WHERE s.code = 'food_services'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'clinics', 'العيادات الطبية', 'Medical Clinics', 1
FROM public.economic_sectors s WHERE s.code = 'healthcare'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'supermarkets', 'المتاجر الكبرى', 'Supermarkets', 1
FROM public.economic_sectors s WHERE s.code = 'retail_trade'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'plastic_products', 'منتجات البلاستيك', 'Plastic Products', 1
FROM public.economic_sectors s WHERE s.code = 'light_manufacturing'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, sort_order)
SELECT s.id, 'warehousing', 'التخزين والمستودعات', 'Warehousing', 1
FROM public.economic_sectors s WHERE s.code = 'logistics_services'
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 3. Activities
-----------------------------------------------------------------------------

INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT
  s.id AS sector_id,
  ss.id AS sub_sector_id,
  'burger_restaurant',
  'مطعم برجر',
  'Burger Restaurant',
  1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'quick_service'
WHERE s.code = 'food_services'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT
  s.id AS sector_id,
  ss.id AS sub_sector_id,
  'dental_clinic',
  'عيادة أسنان',
  'Dental Clinic',
  1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'clinics'
WHERE s.code = 'healthcare'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT
  s.id AS sector_id,
  ss.id AS sub_sector_id,
  'small_supermarket',
  'سوبرماركت صغير',
  'Small Supermarket',
  1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'supermarkets'
WHERE s.code = 'retail_trade'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT
  s.id AS sector_id,
  ss.id AS sub_sector_id,
  'plastic_products_factory',
  'مصنع منتجات بلاستيكية',
  'Plastic Products Factory',
  1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'plastic_products'
WHERE s.code = 'light_manufacturing'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.economic_activities (sector_id, sub_sector_id, code, name_ar, name_en, sort_order)
SELECT
  s.id AS sector_id,
  ss.id AS sub_sector_id,
  'cold_storage_warehouse',
  'مستودع تخزين مبرد',
  'Cold Storage Warehouse',
  1
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'warehousing'
WHERE s.code = 'logistics_services'
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 4. Financial assumptions
-----------------------------------------------------------------------------

INSERT INTO public.financial_assumptions (code, name_ar, name_en, category, unit_type, default_value, min_value, max_value, description)
VALUES
  ('vat_rate', 'نسبة ضريبة القيمة المضافة', 'VAT Rate', 'tax', 'percentage', 15.0, 0.0, 25.0, 'Saudi VAT rate'),
  ('corporate_tax_rate', 'نسبة ضريبة الشركات', 'Corporate Tax Rate', 'tax', 'percentage', 20.0, 0.0, 50.0, 'Estimated corporate income tax'),
  ('annual_depreciation_rate', 'معدل الإهلاك السنوي', 'Annual Depreciation Rate', 'depreciation', 'percentage', 10.0, 0.0, 50.0, 'Straight-line depreciation'),
  ('cogs_ratio', 'نسبة تكلفة البضاعة المباعة', 'COGS Ratio', 'cogs', 'percentage', 35.0, 0.0, 90.0, 'Cost of goods sold / revenue'),
  ('rent_ratio', 'نسبة الإيجار من الإيرادات', 'Rent Ratio', 'opex', 'percentage', 10.0, 0.0, 40.0, 'Rent as percentage of revenue'),
  ('salaries_ratio', 'نسبة الرواتب من الإيرادات', 'Salaries Ratio', 'hr', 'percentage', 20.0, 0.0, 60.0, 'Salaries and wages / revenue'),
  ('marketing_ratio', 'نسبة التسويق', 'Marketing Ratio', 'opex', 'percentage', 3.0, 0.0, 20.0, 'Marketing spend / revenue'),
  ('utilities_ratio', 'نسبة الخدمات', 'Utilities Ratio', 'opex', 'percentage', 2.0, 0.0, 10.0, 'Electricity, water, internet / revenue'),
  ('working_capital_days', 'أيام رأس المال العامل', 'Working Capital Days', 'working_capital', 'days', 30.0, 0.0, 180.0, 'Days of revenue tied in working capital'),
  ('revenue_growth_rate', 'معدل نمو الإيرادات السنوي', 'Annual Revenue Growth Rate', 'revenue', 'percentage', 5.0, -10.0, 50.0, 'Projected annual revenue growth'),
  ('discount_rate', 'معدل الخصم', 'Discount Rate', 'financing', 'percentage', 10.0, 0.0, 30.0, 'Cost of capital for NPV calculation'),
  ('loan_ratio', 'نسبة التمويل بالدين', 'Loan Ratio', 'financing', 'percentage', 50.0, 0.0, 90.0, 'Percentage of capex financed by loan'),
  ('interest_rate', 'نسبة الفائدة على القرض', 'Interest Rate', 'financing', 'percentage', 8.0, 0.0, 20.0, 'Annual loan interest rate'),
  ('loan_term_years', 'مدة القرض بالسنوات', 'Loan Term Years', 'financing', 'count', 5.0, 1.0, 20.0, 'Loan repayment period in years')
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 5. Project models
-----------------------------------------------------------------------------

INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  tags, is_published
)
SELECT
  s.id, ss.id, a.id,
  'burger_restaurant_small',
  'مطعم برجر صغير',
  'Small Burger Restaurant',
  'greenfield', 'small', 'SAR',
  300000, 600000, 400000, 800000,
  4, 8, 18,
  ARRAY['food', 'fast-food', 'retail'],
  true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'quick_service'
JOIN public.economic_activities a ON a.code = 'burger_restaurant'
WHERE s.code = 'food_services'
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
  'dental_clinic_medium',
  'عيادة أسنان متوسطة',
  'Medium Dental Clinic',
  'greenfield', 'medium', 'SAR',
  800000, 1500000, 600000, 1200000,
  5, 10, 24,
  ARRAY['healthcare', 'clinic', 'medical'],
  true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'clinics'
JOIN public.economic_activities a ON a.code = 'dental_clinic'
WHERE s.code = 'healthcare'
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
  'supermarket_small',
  'سوبرماركت صغير',
  'Small Supermarket',
  'greenfield', 'small', 'SAR',
  500000, 1000000, 800000, 1500000,
  3, 6, 20,
  ARRAY['retail', 'grocery', 'supermarket'],
  true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'supermarkets'
JOIN public.economic_activities a ON a.code = 'small_supermarket'
WHERE s.code = 'retail_trade'
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
  'plastic_factory_medium',
  'مصنع منتجات بلاستيكية متوسط',
  'Medium Plastic Products Factory',
  'greenfield', 'medium', 'SAR',
  2000000, 5000000, 1500000, 4000000,
  10, 25, 36,
  ARRAY['manufacturing', 'plastic', 'industrial'],
  true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'plastic_products'
JOIN public.economic_activities a ON a.code = 'plastic_products_factory'
WHERE s.code = 'light_manufacturing'
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
  'cold_storage_small',
  'مستودع تخزين مبرد صغير',
  'Small Cold Storage Warehouse',
  'greenfield', 'small', 'SAR',
  1500000, 3000000, 1000000, 2500000,
  4, 10, 30,
  ARRAY['logistics', 'cold-storage', 'warehouse'],
  true
FROM public.economic_sectors s
JOIN public.economic_sub_sectors ss ON ss.code = 'warehousing'
JOIN public.economic_activities a ON a.code = 'cold_storage_warehouse'
WHERE s.code = 'logistics_services'
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 6. Link models to default assumptions
-----------------------------------------------------------------------------

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT pm.id, fa.id, fa.default_value
FROM public.project_models pm
CROSS JOIN public.financial_assumptions fa
WHERE pm.code IN (
  'burger_restaurant_small', 'dental_clinic_medium', 'supermarket_small',
  'plastic_factory_medium', 'cold_storage_small'
)
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

-----------------------------------------------------------------------------
-- 7. Risk factors
-----------------------------------------------------------------------------

INSERT INTO public.risk_factors (code, name_ar, name_en, category, weight, default_score)
VALUES
  ('market_saturation', 'إشباع السوق', 'Market Saturation', 'market', 1.2, 55),
  ('financing_risk', 'مخاطر التمويل', 'Financing Risk', 'financial', 1.0, 45),
  ('operational_complexity', 'التعقيد التشغيلي', 'Operational Complexity', 'operational', 1.0, 50),
  ('licensing_complexity', 'تعقيد التراخيص', 'Licensing Complexity', 'legal', 0.9, 40),
  ('labor_availability', 'توفر العمالة', 'Labor Availability', 'operational', 1.1, 60),
  ('environmental_risk', 'المخاطر البيئية', 'Environmental Risk', 'environmental', 0.8, 30)
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 8. Link models to risk factors
-----------------------------------------------------------------------------

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT pm.id, rf.id, rf.default_score, 'Initial default risk score'
FROM public.project_models pm
CROSS JOIN public.risk_factors rf
WHERE pm.code IN (
  'burger_restaurant_small', 'dental_clinic_medium', 'supermarket_small',
  'plastic_factory_medium', 'cold_storage_small'
)
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;

-----------------------------------------------------------------------------
-- 9. Cities
-----------------------------------------------------------------------------

INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES
  ('JED', 'جدة', 'Jeddah', 'Makkah', 'SA', 4500000, 1.8, 120000, 92.0),
  ('RUH', 'الرياض', 'Riyadh', 'Riyadh', 'SA', 7500000, 2.1, 140000, 100.0),
  ('DMM', 'الدمام', 'Dammam', 'Eastern', 'SA', 1200000, 1.9, 130000, 95.0),
  ('MED', 'المدينة المنورة', 'Madinah', 'Madinah', 'SA', 1400000, 1.6, 100000, 82.0),
  ('YNB', 'ينبع', 'Yanbu', 'Madinah', 'SA', 350000, 1.4, 115000, 85.0)
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 10. Sample city market data for burger restaurants
-----------------------------------------------------------------------------

INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT
  c.id, a.id,
  CASE c.code
    WHEN 'JED' THEN 120
    WHEN 'RUH' THEN 180
    WHEN 'DMM' THEN 60
    WHEN 'MED' THEN 40
    WHEN 'YNB' THEN 15
  END,
  CASE c.code
    WHEN 'JED' THEN 2.5
    WHEN 'RUH' THEN 2.2
    WHEN 'DMM' THEN 3.0
    WHEN 'MED' THEN 4.0
    WHEN 'YNB' THEN 5.0
  END,
  CASE c.code
    WHEN 'JED' THEN 1800
    WHEN 'RUH' THEN 2200
    WHEN 'DMM' THEN 1400
    WHEN 'MED' THEN 1000
    WHEN 'YNB' THEN 800
  END,
  CASE c.code
    WHEN 'JED' THEN 12000
    WHEN 'RUH' THEN 15000
    WHEN 'DMM' THEN 9000
    WHEN 'MED' THEN 7000
    WHEN 'YNB' THEN 5500
  END,
  CASE c.code
    WHEN 'JED' THEN 7500
    WHEN 'RUH' THEN 8500
    WHEN 'DMM' THEN 8000
    WHEN 'MED' THEN 6500
    WHEN 'YNB' THEN 7000
  END,
  CASE c.code
    WHEN 'JED' THEN 70
    WHEN 'RUH' THEN 80
    WHEN 'DMM' THEN 65
    WHEN 'MED' THEN 60
    WHEN 'YNB' THEN 50
  END,
  CASE c.code
    WHEN 'JED' THEN 75
    WHEN 'RUH' THEN 85
    WHEN 'DMM' THEN 55
    WHEN 'MED' THEN 45
    WHEN 'YNB' THEN 30
  END,
  2025,
  'Bonds sample dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;

COMMIT;
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
-- Bonds V3 — Cities & Market Data (Auto-generated)
-- Generated at: 2026-06-13T13:42:10.285Z

BEGIN;

-- Cities
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('RUH', 'الرياض', 'Riyadh', 'Riyadh', 'SA', 7500000, 2.1, 140000, 100)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('JED', 'جدة', 'Jeddah', 'Makkah', 'SA', 4500000, 1.8, 120000, 92)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('DMM', 'الدمام', 'Dammam', 'Eastern', 'SA', 1200000, 1.9, 130000, 95)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('KHB', 'الخبر', 'Khobar', 'Eastern', 'SA', 800000, 1.7, 135000, 96)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('MED', 'المدينة المنورة', 'Madinah', 'Madinah', 'SA', 1400000, 1.6, 100000, 82)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('YNB', 'ينبع', 'Yanbu', 'Madinah', 'SA', 350000, 1.4, 115000, 85)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('ABH', 'أبها', 'Abha', 'Asir', 'SA', 700000, 1.5, 90000, 75)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('ELQ', 'بريدة', 'Buraidah', 'Qassim', 'SA', 650000, 1.6, 95000, 78)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('TIF', 'الطائف', 'Taif', 'Makkah', 'SA', 900000, 1.5, 88000, 74)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, population_growth_rate, avg_household_income, purchasing_power_index)
VALUES ('TBU', 'تبوك', 'Tabuk', 'Tabuk', 'SA', 600000, 1.7, 98000, 76)
ON CONFLICT (code) DO NOTHING;

-- City Market Data
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 150, 1, 1800, 11700, 7500, 75, 70, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 120, 1.25, 1600, 10400, 7000, 75, 65, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 60, 2.5, 1400, 9100, 6500, 75, 55, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 90, 1.67, 1500, 9750, 8000, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 75, 2, 1700, 11050, 9000, 75, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 105, 1.43, 1500, 9750, 6500, 75, 60, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 83, 1.81, 1550, 10075, 6800, 75, 58, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 45, 3.33, 900, 5850, 7000, 75, 40, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 38, 3.95, 1200, 7800, 8000, 75, 35, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 23, 6.52, 2500, 16250, 8500, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'RUH' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 90, 1.67, 1800, 11700, 6900, 75, 70, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 72, 2.08, 1600, 10400, 6440, 75, 65, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 36, 4.17, 1400, 9100, 5980, 75, 55, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 54, 2.78, 1500, 9750, 7360, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 45, 3.33, 1700, 11050, 8280, 75, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 63, 2.38, 1500, 9750, 5980, 75, 60, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 50, 3, 1550, 10075, 6256, 75, 58, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 27, 5.56, 900, 5850, 6440, 75, 40, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 23, 6.52, 1200, 7800, 7360, 75, 35, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 14, 10.71, 2500, 16250, 7820, 75, 50, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'JED' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 18, 8.33, 1350, 8775, 7125, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 14, 10.71, 1200, 7800, 6650, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1050, 6825, 6175, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 11, 13.64, 1125, 7313, 7600, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 9, 16.67, 1275, 8288, 8550, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 13, 11.54, 1125, 7313, 6175, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 1163, 7560, 6460, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 675, 4388, 6650, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 900, 5850, 7600, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 8075, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'DMM' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 12, 12.5, 1350, 8775, 7200, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 1200, 7800, 6720, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 1050, 6825, 6240, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1125, 7313, 7680, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 1275, 8288, 8640, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 1125, 7313, 6240, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 1163, 7560, 6528, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 675, 4388, 6720, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 900, 5850, 7680, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 8160, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'KHB' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 21, 7.14, 1350, 8775, 6150, 70, 53, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 17, 8.82, 1200, 7800, 5740, 70, 49, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 1050, 6825, 5330, 70, 41, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 13, 11.54, 1125, 7313, 6560, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 11, 13.64, 1275, 8288, 7380, 70, 34, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 15, 10, 1125, 7313, 5330, 70, 45, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 12, 12.5, 1163, 7560, 5576, 70, 44, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 675, 4388, 5740, 70, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 900, 5850, 6560, 70, 26, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1875, 12188, 6970, 70, 38, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'MED' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 990, 6435, 6375, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 880, 5720, 5950, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 5525, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 825, 5363, 6800, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 935, 6078, 7650, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 825, 5363, 5525, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 853, 5545, 5780, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5950, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6800, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 7225, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'YNB' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 990, 6435, 5625, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 880, 5720, 5250, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 4875, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 6000, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 935, 6078, 6750, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 4875, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5100, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5250, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6000, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6375, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ABH' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 990, 6435, 5850, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 880, 5720, 5460, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 5070, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 825, 5363, 6240, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 935, 6078, 7020, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 5070, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5304, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5460, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6240, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6630, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'ELQ' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 10, 15, 990, 6435, 5550, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 8, 18.75, 880, 5720, 5180, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 770, 5005, 4810, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 6, 25, 825, 5363, 5920, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 935, 6078, 6660, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 825, 5363, 4810, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 853, 5545, 5032, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5180, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 5920, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6290, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TIF' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 7, 21.43, 990, 6435, 5700, 65, 39, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'burger_restaurant'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 880, 5720, 5320, 65, 36, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'coffee_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 770, 5005, 4940, 65, 30, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'small_supermarket'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 825, 5363, 6080, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'pharmacy'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 935, 6078, 6840, 65, 25, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'dental_clinic'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 5, 30, 825, 5363, 4940, 65, 33, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'clothing_store'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 4, 37.5, 853, 5545, 5168, 65, 32, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'mobile_shop'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 495, 3218, 5320, 65, 22, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'last_mile_delivery'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 660, 4290, 6080, 65, 20, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'kindergarten'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
INSERT INTO public.city_market_data (
  city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
  avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score, data_year, source
)
SELECT c.id, a.id, 3, 50, 1375, 8938, 6460, 65, 28, 2025, 'Bonds market dataset'
FROM public.cities c
CROSS JOIN public.economic_activities a
WHERE c.code = 'TBU' AND a.code = 'boutique_hotel'
ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;

COMMIT;
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
