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
