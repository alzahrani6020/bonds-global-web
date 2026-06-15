-- Bonds V3 — Data Acquisition & Fusion Platform
-- Adds Bronze/Silver/Gold data layers and source adapters infrastructure.

-- ============================================================
-- 1. Bronze layer: raw data ingestion tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.data_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('full', 'incremental', 'manual')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_fetched int NOT NULL DEFAULT 0,
  records_valid int NOT NULL DEFAULT 0,
  records_imported int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_data_source_runs_source_id
  ON public.data_source_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_data_source_runs_status
  ON public.data_source_runs(status);
CREATE INDEX IF NOT EXISTS idx_data_source_runs_started_at
  ON public.data_source_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS public.raw_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.data_source_runs(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  external_id text,
  raw_payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_data_run_id
  ON public.raw_data(run_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_source_id
  ON public.raw_data(source_id);

-- ============================================================
-- 2. Silver layer: normalized metrics with confidence
-- ============================================================

CREATE TABLE IF NOT EXISTS public.metric_definitions (
  code text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('city', 'market', 'labor', 'real_estate', 'pricing', 'competition')),
  name_ar text NOT NULL,
  name_en text,
  unit text,
  data_type text NOT NULL CHECK (data_type IN ('number', 'percent', 'currency', 'index', 'text')),
  default_confidence_method text CHECK (default_confidence_method IN ('official', 'estimated', 'manual')),
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_category
  ON public.metric_definitions(category);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_active
  ON public.metric_definitions(is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.normalized_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL REFERENCES public.metric_definitions(code) ON DELETE RESTRICT,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  year int NOT NULL,
  value numeric,
  value_text text,
  source_id text NOT NULL,
  source_name text,
  source_url text,
  confidence int NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  confidence_reason text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  valid_from date,
  valid_until date,
  is_override boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_code, city_id, activity_id, year, source_id)
);

CREATE INDEX IF NOT EXISTS idx_normalized_metrics_metric_code
  ON public.normalized_metrics(metric_code);
CREATE INDEX IF NOT EXISTS idx_normalized_metrics_city_id
  ON public.normalized_metrics(city_id);
CREATE INDEX IF NOT EXISTS idx_normalized_metrics_activity_id
  ON public.normalized_metrics(activity_id);
CREATE INDEX IF NOT EXISTS idx_normalized_metrics_year
  ON public.normalized_metrics(year);
CREATE INDEX IF NOT EXISTS idx_normalized_metrics_city_activity_year
  ON public.normalized_metrics(city_id, activity_id, year);
CREATE INDEX IF NOT EXISTS idx_normalized_metrics_confidence
  ON public.normalized_metrics(confidence DESC);

-- ============================================================
-- 3. Gold layer: fused city indicators
-- ============================================================

CREATE TABLE IF NOT EXISTS public.city_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  year int NOT NULL,
  gdp_city numeric(14,2),
  growth_rate numeric(5,2),
  unemployment_rate numeric(5,2),
  establishments_count int,
  inflation_rate numeric(5,2),
  business_ease_index numeric(5,2),
  avg_rent_per_sqm numeric(12,2),
  avg_land_price_per_sqm numeric(12,2),
  warehouse_rent_per_sqm numeric(12,2),
  factory_rent_per_sqm numeric(12,2),
  new_licenses_count int,
  investment_volume numeric(14,2),
  saturation_index numeric(5,2),
  overall_confidence int CHECK (overall_confidence BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city_id, year)
);

CREATE INDEX IF NOT EXISTS idx_city_indicators_city_id
  ON public.city_indicators(city_id);
CREATE INDEX IF NOT EXISTS idx_city_indicators_year
  ON public.city_indicators(year);

-- ============================================================
-- 4. Update existing tables
-- ============================================================

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS gdp_city numeric(14,2),
  ADD COLUMN IF NOT EXISTS growth_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS unemployment_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS establishments_count int,
  ADD COLUMN IF NOT EXISTS inflation_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS business_ease_index numeric(5,2);

ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS market_size numeric(14,2),
  ADD COLUMN IF NOT EXISTS annual_growth_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS per_capita_spending numeric(12,2),
  ADD COLUMN IF NOT EXISTS expected_demand text CHECK (expected_demand IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS profit_margin_min numeric(5,2),
  ADD COLUMN IF NOT EXISTS profit_margin_avg numeric(5,2),
  ADD COLUMN IF NOT EXISTS profit_margin_max numeric(5,2),
  ADD COLUMN IF NOT EXISTS risk_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS confidence int CHECK (confidence BETWEEN 0 AND 100);

ALTER TABLE public.project_models
  ADD COLUMN IF NOT EXISTS roi_min numeric(5,2),
  ADD COLUMN IF NOT EXISTS roi_avg numeric(5,2),
  ADD COLUMN IF NOT EXISTS roi_max numeric(5,2),
  ADD COLUMN IF NOT EXISTS irr_min numeric(5,2),
  ADD COLUMN IF NOT EXISTS irr_avg numeric(5,2),
  ADD COLUMN IF NOT EXISTS irr_max numeric(5,2),
  ADD COLUMN IF NOT EXISTS npv_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS npv_avg numeric(14,2),
  ADD COLUMN IF NOT EXISTS npv_max numeric(14,2),
  ADD COLUMN IF NOT EXISTS payback_months_min int,
  ADD COLUMN IF NOT EXISTS payback_months_avg int,
  ADD COLUMN IF NOT EXISTS payback_months_max int,
  ADD COLUMN IF NOT EXISTS break_even_revenue_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS break_even_revenue_avg numeric(14,2),
  ADD COLUMN IF NOT EXISTS break_even_revenue_max numeric(14,2),
  ADD COLUMN IF NOT EXISTS land_cost_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS land_cost_avg numeric(14,2),
  ADD COLUMN IF NOT EXISTS land_cost_max numeric(14,2),
  ADD COLUMN IF NOT EXISTS construction_cost_per_sqm numeric(12,2),
  ADD COLUMN IF NOT EXISTS equipment_cost_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS equipment_cost_avg numeric(14,2),
  ADD COLUMN IF NOT EXISTS equipment_cost_max numeric(14,2),
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_avg numeric(14,2),
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_max numeric(14,2);

-- ============================================================
-- 5. Seed metric definitions
-- ============================================================

INSERT INTO public.metric_definitions (code, category, name_ar, name_en, unit, data_type, default_confidence_method, description, sort_order)
VALUES
  -- City
  ('population', 'city', 'عدد السكان', 'Population', 'person', 'number', 'official', 'إجمالي عدد السكان في المدينة', 1),
  ('household_income', 'city', 'متوسط دخل الأسرة', 'Average Household Income', 'SAR', 'currency', 'official', 'متوسط الدخل السنوي للأسرة', 2),
  ('purchasing_power_index', 'city', 'مؤشر القوة الشرائية', 'Purchasing Power Index', 'index', 'index', 'estimated', 'مؤشر نسبي للقوة الشرائية', 3),
  ('gdp_city', 'city', 'GDP المدينة', 'City GDP', 'SAR', 'currency', 'estimated', 'الناتج المحلي الإجمالي التقديري للمدينة', 4),
  ('growth_rate', 'city', 'معدل النمو', 'Growth Rate', '%', 'percent', 'official', 'معدل النمو الاقتصادي السنوي', 5),
  ('unemployment_rate', 'city', 'معدل البطالة', 'Unemployment Rate', '%', 'percent', 'official', 'نسبة البطالة في المدينة', 6),
  ('establishments_count', 'city', 'عدد المنشآت', 'Establishments Count', 'establishment', 'number', 'official', 'عدد المنشآت التجارية المسجلة', 7),
  ('inflation_rate', 'city', 'معدل التضخم', 'Inflation Rate', '%', 'percent', 'official', 'معدل التضخم السنوي', 8),
  ('business_ease_index', 'city', 'مؤشر سهولة ممارسة الأعمال', 'Business Ease Index', 'index', 'index', 'estimated', 'مؤشر سهولة ممارسة الأعمال', 9),

  -- Real Estate
  ('avg_rent_per_sqm', 'real_estate', 'متوسط الإيجار للمتر المربع', 'Average Rent per Sqm', 'SAR', 'currency', 'estimated', 'متوسط الإيجار السنوي للمتر المربع', 10),
  ('avg_land_price_per_sqm', 'real_estate', 'متوسط سعر الأرض للمتر المربع', 'Average Land Price per Sqm', 'SAR', 'currency', 'estimated', 'متوسط سعر الأرض للمتر المربع', 11),
  ('warehouse_rent_per_sqm', 'real_estate', 'إيجار المستودعات للمتر المربع', 'Warehouse Rent per Sqm', 'SAR', 'currency', 'estimated', 'إيجار المستودعات للمتر المربع', 12),
  ('factory_rent_per_sqm', 'real_estate', 'إيجار المصانع للمتر المربع', 'Factory Rent per Sqm', 'SAR', 'currency', 'estimated', 'إيجار المصانع للمتر المربع', 13),

  -- Labor
  ('specialists_count', 'labor', 'عدد المتخصصين', 'Specialists Count', 'person', 'number', 'estimated', 'عدد المتخصصين في النشاط', 14),
  ('avg_salary', 'labor', 'متوسط الراتب', 'Average Salary', 'SAR', 'currency', 'estimated', 'متوسط الراتب الشهري', 15),
  ('labor_availability_score', 'labor', 'توفر العمالة', 'Labor Availability', '%', 'percent', 'estimated', 'نسبة توفر العمالة المناسبة', 16),
  ('saudization_rate', 'labor', 'نسبة السعودة', 'Saudization Rate', '%', 'percent', 'estimated', 'نسبة السعودة المتوقعة', 17),

  -- Competition
  ('competitors_count', 'competition', 'عدد المنافسين', 'Competitors Count', 'competitor', 'number', 'estimated', 'عدد المنافسين في المدينة', 18),
  ('competition_level', 'competition', 'درجة المنافسة', 'Competition Level', 'level', 'text', 'estimated', 'منخفضة / متوسطة / مرتفعة', 19),
  ('market_saturation_score', 'competition', 'مؤشر التشبع', 'Market Saturation', '%', 'percent', 'estimated', 'نسبة تشبع السوق', 20),

  -- Market
  ('market_size', 'market', 'حجم السوق', 'Market Size', 'SAR', 'currency', 'estimated', 'حجم السوق السنوي التقديري', 21),
  ('annual_growth_rate', 'market', 'النمو السنوي', 'Annual Growth Rate', '%', 'percent', 'estimated', 'معدل النمو السنوي للسوق', 22),
  ('per_capita_spending', 'market', 'الإنفاق للفرد', 'Per Capita Spending', 'SAR', 'currency', 'estimated', 'متوسط الإنفاق السنوي للفرد', 23),
  ('expected_demand', 'market', 'الطلب المتوقع', 'Expected Demand', 'level', 'text', 'estimated', 'منخفض / متوسط / مرتفع', 24),

  -- Pricing
  ('construction_cost_per_sqm', 'pricing', 'تكلفة البناء للمتر المربع', 'Construction Cost per Sqm', 'SAR', 'currency', 'estimated', 'تكلفة البناء للمتر المربع', 25),
  ('equipment_cost_min', 'pricing', 'تكلفة المعدات الأدنى', 'Equipment Cost Min', 'SAR', 'currency', 'estimated', 'أقل تكلفة للمعدات', 26),
  ('equipment_cost_avg', 'pricing', 'تكلفة المعدات المتوسطة', 'Equipment Cost Avg', 'SAR', 'currency', 'estimated', 'متوسط تكلفة المعدات', 27),
  ('equipment_cost_max', 'pricing', 'تكلفة المعدات الأعلى', 'Equipment Cost Max', 'SAR', 'currency', 'estimated', 'أعلى تكلفة للمعدات', 28)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  unit = EXCLUDED.unit,
  data_type = EXCLUDED.data_type,
  default_confidence_method = EXCLUDED.default_confidence_method,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 6. RLS policies
-- ============================================================

ALTER TABLE public.data_source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_indicators ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public can read metric definitions"
  ON public.metric_definitions FOR SELECT TO anon, authenticated, service_role USING (is_active = true);

CREATE POLICY "Public can read normalized metrics"
  ON public.normalized_metrics FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Public can read city indicators"
  ON public.city_indicators FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Public can read data source runs"
  ON public.data_source_runs FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Public can read raw data"
  ON public.raw_data FOR SELECT TO anon, authenticated, service_role USING (true);

-- Service role management
CREATE POLICY "Service role can manage data source runs"
  ON public.data_source_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage raw data"
  ON public.raw_data FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage metric definitions"
  ON public.metric_definitions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage normalized metrics"
  ON public.normalized_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage city indicators"
  ON public.city_indicators FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 7. Helper function: update city_indicators updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS city_indicators_updated_at ON public.city_indicators;
CREATE TRIGGER city_indicators_updated_at
  BEFORE UPDATE ON public.city_indicators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
