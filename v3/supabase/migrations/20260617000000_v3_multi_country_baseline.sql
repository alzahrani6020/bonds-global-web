-- Bonds V3 — Multi-country baseline
-- Adds country-level benchmarks and sample cities for UAE, Qatar, Egypt, Jordan.

-- ============================================================
-- 1. Country benchmarks (used by city-adjustment engine)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.country_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  metric_code text NOT NULL,
  benchmark_value numeric NOT NULL,
  year int NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, metric_code, year)
);

CREATE INDEX IF NOT EXISTS idx_country_benchmarks_country_metric
  ON public.country_benchmarks(country_code, metric_code);

-- Public read
ALTER TABLE public.country_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read country benchmarks"
  ON public.country_benchmarks FOR SELECT TO anon, authenticated, service_role USING (true);
CREATE POLICY "Service role can manage country benchmarks"
  ON public.country_benchmarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS country_benchmarks_updated_at ON public.country_benchmarks;
CREATE TRIGGER country_benchmarks_updated_at
  BEFORE UPDATE ON public.country_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Seed country benchmarks (2025)
-- ============================================================

INSERT INTO public.country_benchmarks (country_code, metric_code, benchmark_value, year, source) VALUES
  -- Saudi Arabia (baseline)
  ('SA', 'avg_rent_per_sqm', 1200, 2025, 'Bonds internal'),
  ('SA', 'avg_salary', 8000, 2025, 'Bonds internal'),
  ('SA', 'purchasing_power_index', 100, 2025, 'Bonds internal'),
  ('SA', 'inflation_rate', 2.5, 2025, 'Bonds internal'),
  ('SA', 'growth_rate', 3.0, 2025, 'Bonds internal'),
  ('SA', 'business_ease_index', 70, 2025, 'Bonds internal'),
  ('SA', 'unemployment_rate', 6.0, 2025, 'Bonds internal'),

  -- United Arab Emirates
  ('AE', 'avg_rent_per_sqm', 1500, 2025, 'Bonds internal'),
  ('AE', 'avg_salary', 12000, 2025, 'Bonds internal'),
  ('AE', 'purchasing_power_index', 110, 2025, 'Bonds internal'),
  ('AE', 'inflation_rate', 2.1, 2025, 'Bonds internal'),
  ('AE', 'growth_rate', 4.5, 2025, 'Bonds internal'),
  ('AE', 'business_ease_index', 82, 2025, 'Bonds internal'),
  ('AE', 'unemployment_rate', 3.2, 2025, 'Bonds internal'),

  -- Qatar
  ('QA', 'avg_rent_per_sqm', 1400, 2025, 'Bonds internal'),
  ('QA', 'avg_salary', 13000, 2025, 'Bonds internal'),
  ('QA', 'purchasing_power_index', 108, 2025, 'Bonds internal'),
  ('QA', 'inflation_rate', 2.0, 2025, 'Bonds internal'),
  ('QA', 'growth_rate', 3.8, 2025, 'Bonds internal'),
  ('QA', 'business_ease_index', 78, 2025, 'Bonds internal'),
  ('QA', 'unemployment_rate', 3.0, 2025, 'Bonds internal'),

  -- Egypt
  ('EG', 'avg_rent_per_sqm', 350, 2025, 'Bonds internal'),
  ('EG', 'avg_salary', 2500, 2025, 'Bonds internal'),
  ('EG', 'purchasing_power_index', 45, 2025, 'Bonds internal'),
  ('EG', 'inflation_rate', 12.0, 2025, 'Bonds internal'),
  ('EG', 'growth_rate', 4.0, 2025, 'Bonds internal'),
  ('EG', 'business_ease_index', 50, 2025, 'Bonds internal'),
  ('EG', 'unemployment_rate', 7.0, 2025, 'Bonds internal'),

  -- Jordan
  ('JO', 'avg_rent_per_sqm', 500, 2025, 'Bonds internal'),
  ('JO', 'avg_salary', 3500, 2025, 'Bonds internal'),
  ('JO', 'purchasing_power_index', 55, 2025, 'Bonds internal'),
  ('JO', 'inflation_rate', 3.5, 2025, 'Bonds internal'),
  ('JO', 'growth_rate', 2.5, 2025, 'Bonds internal'),
  ('JO', 'business_ease_index', 58, 2025, 'Bonds internal'),
  ('JO', 'unemployment_rate', 14.0, 2025, 'Bonds internal')
ON CONFLICT (country_code, metric_code, year) DO UPDATE SET
  benchmark_value = EXCLUDED.benchmark_value,
  source = EXCLUDED.source,
  updated_at = now();

-- ============================================================
-- 3. Seed sample cities for new countries
-- ============================================================

INSERT INTO public.cities (
  code, name_ar, name_en, region, country_code,
  population, population_growth_rate, avg_household_income, purchasing_power_index
) VALUES
  ('DXB', 'دبي', 'Dubai', 'Dubai', 'AE', 3500000, 2.0, 240000, 110),
  ('AUH', 'أبوظبي', 'Abu Dhabi', 'Abu Dhabi', 'AE', 2800000, 1.8, 264000, 108),
  ('DOH', 'الدوحة', 'Doha', 'Doha', 'QA', 2400000, 1.9, 288000, 108),
  ('CAI', 'القاهرة', 'Cairo', 'Cairo', 'EG', 10000000, 1.9, 96000, 45),
  ('ALY', 'الإسكندرية', 'Alexandria', 'Alexandria', 'EG', 5200000, 1.7, 90000, 42),
  ('AMM', 'عمّان', 'Amman', 'Amman', 'JO', 4000000, 2.1, 108000, 55)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  region = EXCLUDED.region,
  country_code = EXCLUDED.country_code,
  population = EXCLUDED.population,
  population_growth_rate = EXCLUDED.population_growth_rate,
  avg_household_income = EXCLUDED.avg_household_income,
  purchasing_power_index = EXCLUDED.purchasing_power_index;
