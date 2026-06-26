-- BONDS Market Intelligence Database
-- Central repository for market data used by BONDS Valuation Intelligence.

CREATE TABLE IF NOT EXISTS public.market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  country text,
  city text,
  average_selling_price numeric NOT NULL DEFAULT 0,
  average_buying_price numeric NOT NULL DEFAULT 0,
  transaction_count numeric NOT NULL DEFAULT 0,
  supply_index numeric NOT NULL DEFAULT 5,
  demand_index numeric NOT NULL DEFAULT 5,
  competitor_count numeric NOT NULL DEFAULT 0,
  average_sale_speed_days numeric NOT NULL DEFAULT 0,
  inflation_rate numeric NOT NULL DEFAULT 0.03,
  interest_rate numeric NOT NULL DEFAULT 0.05,
  economic_growth_rate numeric NOT NULL DEFAULT 0.03,
  source text,
  recorded_at date DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(asset_class, country, city)
);

COMMENT ON TABLE public.market_data IS 'Central market intelligence data for BONDS Valuation Intelligence';

-- Enable RLS
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

-- Everyone can read; only authenticated users with admin/editor role can write.
CREATE POLICY "Market data is readable by everyone"
  ON public.market_data
  FOR SELECT
  USING (true);

CREATE POLICY "Market data is editable by admins"
  ON public.market_data
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

-- Seed initial data for 35 asset classes (global defaults).
INSERT INTO public.market_data
  (asset_class, country, city, average_selling_price, average_buying_price, transaction_count, supply_index, demand_index, competitor_count, average_sale_speed_days, inflation_rate, interest_rate, economic_growth_rate, source)
VALUES
  ('realEstate', NULL, NULL, 2500000, 2300000, 120, 5, 6, 50, 90, 0.025, 0.06, 0.035, 'BONDS Market Intelligence'),
  ('business', NULL, NULL, 5000000, 4500000, 45, 4, 5, 30, 180, 0.025, 0.07, 0.03, 'BONDS Market Intelligence'),
  ('factory', NULL, NULL, 8000000, 7200000, 20, 3, 4, 15, 240, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('machineryEquipment', NULL, NULL, 1200000, 1000000, 80, 5, 5, 40, 60, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('vehiclesFleet', NULL, NULL, 600000, 550000, 200, 6, 6, 25, 30, 0.025, 0.055, 0.03, 'BONDS Market Intelligence'),
  ('agricultureFarms', NULL, NULL, 3500000, 3200000, 35, 4, 5, 10, 150, 0.025, 0.06, 0.025, 'BONDS Market Intelligence'),
  ('livestock', NULL, NULL, 500000, 450000, 60, 5, 5, 8, 45, 0.025, 0.06, 0.02, 'BONDS Market Intelligence'),
  ('naturalResourcesMining', NULL, NULL, 15000000, 14000000, 10, 3, 4, 5, 365, 0.03, 0.07, 0.02, 'BONDS Market Intelligence'),
  ('oilGas', NULL, NULL, 25000000, 23000000, 8, 3, 4, 6, 365, 0.03, 0.07, 0.02, 'BONDS Market Intelligence'),
  ('infrastructure', NULL, NULL, 30000000, 28000000, 5, 2, 3, 4, 540, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('intellectualProperty', NULL, NULL, 2000000, 1800000, 40, 5, 6, 35, 120, 0.025, 0.07, 0.04, 'BONDS Market Intelligence'),
  ('brandsTrademarks', NULL, NULL, 3000000, 2700000, 30, 5, 6, 25, 150, 0.025, 0.07, 0.035, 'BONDS Market Intelligence'),
  ('patents', NULL, NULL, 1500000, 1300000, 25, 4, 5, 20, 180, 0.025, 0.07, 0.035, 'BONDS Market Intelligence'),
  ('copyrightsContent', NULL, NULL, 1200000, 1000000, 50, 5, 6, 30, 90, 0.025, 0.07, 0.04, 'BONDS Market Intelligence'),
  ('franchises', NULL, NULL, 2500000, 2200000, 35, 4, 5, 18, 150, 0.025, 0.07, 0.03, 'BONDS Market Intelligence'),
  ('licensesPermits', NULL, NULL, 800000, 700000, 55, 5, 5, 22, 90, 0.025, 0.065, 0.03, 'BONDS Market Intelligence'),
  ('financialAssets', NULL, NULL, 1000000, 950000, 500, 5, 5, 0, 1, 0.02, 0.04, 0.03, 'BONDS Market Intelligence'),
  ('cryptoDigital', NULL, NULL, 500000, 480000, 1000, 8, 8, 0, 1, 0.03, 0.05, 0.05, 'BONDS Market Intelligence'),
  ('commodities', NULL, NULL, 300000, 280000, 800, 5, 5, 0, 7, 0.025, 0.045, 0.02, 'BONDS Market Intelligence'),
  ('artCollectibles', NULL, NULL, 5000000, 4500000, 25, 4, 5, 40, 270, 0.025, 0.05, 0.03, 'BONDS Market Intelligence'),
  ('jewelryPreciousMetals', NULL, NULL, 4000000, 3600000, 60, 5, 6, 35, 60, 0.02, 0.045, 0.025, 'BONDS Market Intelligence'),
  ('softwareTechnology', NULL, NULL, 3500000, 3000000, 70, 6, 7, 50, 120, 0.025, 0.06, 0.05, 'BONDS Market Intelligence'),
  ('medicalEquipment', NULL, NULL, 2500000, 2200000, 40, 4, 5, 20, 120, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('educationalEquipment', NULL, NULL, 1800000, 1600000, 45, 4, 5, 18, 120, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('distressedAsset', NULL, NULL, 1000000, 900000, 15, 7, 3, 10, 90, 0.03, 0.08, 0.01, 'BONDS Market Intelligence'),
  ('tourismAsset', NULL, NULL, 7000000, 6500000, 20, 4, 5, 12, 210, 0.025, 0.065, 0.035, 'BONDS Market Intelligence'),
  ('personalWealth', NULL, NULL, 2000000, 1900000, 100, 5, 5, 0, 30, 0.025, 0.05, 0.03, 'BONDS Market Intelligence'),
  ('scrapSalvage', NULL, NULL, 150000, 130000, 120, 5, 5, 8, 14, 0.025, 0.06, 0.02, 'BONDS Market Intelligence'),
  ('maritimeAsset', NULL, NULL, 12000000, 11000000, 12, 3, 4, 6, 300, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('logisticsAsset', NULL, NULL, 9000000, 8500000, 18, 4, 5, 10, 180, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('fuelStation', NULL, NULL, 5000000, 4600000, 30, 4, 5, 14, 150, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('beautyWellness', NULL, NULL, 1200000, 1100000, 55, 5, 5, 25, 90, 0.025, 0.06, 0.035, 'BONDS Market Intelligence'),
  ('giftsStationery', NULL, NULL, 800000, 720000, 70, 5, 5, 30, 60, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('furnitureAsset', NULL, NULL, 900000, 800000, 65, 5, 5, 28, 75, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('retailBusiness', NULL, NULL, 2500000, 2300000, 50, 5, 5, 35, 120, 0.025, 0.06, 0.035, 'BONDS Market Intelligence')
ON CONFLICT (asset_class, country, city) DO UPDATE SET
  average_selling_price = EXCLUDED.average_selling_price,
  average_buying_price = EXCLUDED.average_buying_price,
  transaction_count = EXCLUDED.transaction_count,
  supply_index = EXCLUDED.supply_index,
  demand_index = EXCLUDED.demand_index,
  competitor_count = EXCLUDED.competitor_count,
  average_sale_speed_days = EXCLUDED.average_sale_speed_days,
  inflation_rate = EXCLUDED.inflation_rate,
  interest_rate = EXCLUDED.interest_rate,
  economic_growth_rate = EXCLUDED.economic_growth_rate,
  source = EXCLUDED.source,
  updated_at = now();

-- Index for fast lookup.
CREATE INDEX IF NOT EXISTS idx_market_data_lookup
  ON public.market_data(asset_class, country, city);
-- BONDS Market Intelligence Engine v2
-- Historical tracking, AI insights scoring, region/sector granularity, and ingestion sources.

-- 1. Expand market_data with region/sector and analytical fields
ALTER TABLE public.market_data
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_score numeric(3,1) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS outlook text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS data_quality_score numeric(3,0) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS notes text;

-- Normalize any pre-existing NULL dimensional values to empty strings
UPDATE public.market_data
SET country = COALESCE(country, ''),
    region = COALESCE(region, ''),
    city = COALESCE(city, ''),
    sector = COALESCE(sector, ''),
    risk_score = COALESCE(risk_score, 5),
    outlook = COALESCE(outlook, 'neutral'),
    confidence = COALESCE(confidence, 0.5),
    data_quality_score = COALESCE(data_quality_score, 50),
    notes = COALESCE(notes, '')
WHERE country IS NULL
   OR region IS NULL
   OR city IS NULL
   OR sector IS NULL
   OR risk_score IS NULL
   OR outlook IS NULL
   OR confidence IS NULL
   OR data_quality_score IS NULL
   OR notes IS NULL;

-- Enforce defaults and non-null dimensions for future inserts
ALTER TABLE public.market_data
  ALTER COLUMN country SET NOT NULL,
  ALTER COLUMN region SET NOT NULL,
  ALTER COLUMN city SET NOT NULL,
  ALTER COLUMN sector SET NOT NULL;

-- Replace old lookup index with a unique dimensional index
DROP INDEX IF EXISTS idx_market_data_lookup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_unique_dims
  ON public.market_data (asset_class, country, region, city, sector);
CREATE INDEX IF NOT EXISTS idx_market_data_lookup
  ON public.market_data (asset_class, country, region, city, sector);

-- 2. Historical snapshot table
CREATE TABLE IF NOT EXISTS public.market_data_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_data_id uuid REFERENCES public.market_data(id) ON DELETE CASCADE,
  asset_class text NOT NULL,
  country text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  average_selling_price numeric NOT NULL DEFAULT 0,
  average_buying_price numeric NOT NULL DEFAULT 0,
  transaction_count numeric NOT NULL DEFAULT 0,
  supply_index numeric NOT NULL DEFAULT 5,
  demand_index numeric NOT NULL DEFAULT 5,
  competitor_count numeric NOT NULL DEFAULT 0,
  average_sale_speed_days numeric NOT NULL DEFAULT 0,
  inflation_rate numeric NOT NULL DEFAULT 0.03,
  interest_rate numeric NOT NULL DEFAULT 0.05,
  economic_growth_rate numeric NOT NULL DEFAULT 0.03,
  risk_score numeric(3,1) NOT NULL DEFAULT 5,
  outlook text NOT NULL DEFAULT 'neutral',
  confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  data_quality_score numeric(3,0) NOT NULL DEFAULT 50,
  notes text,
  source text,
  recorded_at date DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_data_history_lookup
  ON public.market_data_history (asset_class, country, region, city, sector, created_at DESC);

COMMENT ON TABLE public.market_data_history IS 'Point-in-time snapshots of market_data for trend analysis';

-- 3. Trigger to snapshot every insert/update
CREATE OR REPLACE FUNCTION public.market_data_history_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.market_data_history (
    market_data_id, asset_class, country, region, city, sector,
    average_selling_price, average_buying_price, transaction_count,
    supply_index, demand_index, competitor_count, average_sale_speed_days,
    inflation_rate, interest_rate, economic_growth_rate,
    risk_score, outlook, confidence, data_quality_score, notes, source, recorded_at
  ) VALUES (
    NEW.id, NEW.asset_class, NEW.country, NEW.region, NEW.city, NEW.sector,
    NEW.average_selling_price, NEW.average_buying_price, NEW.transaction_count,
    NEW.supply_index, NEW.demand_index, NEW.competitor_count, NEW.average_sale_speed_days,
    NEW.inflation_rate, NEW.interest_rate, NEW.economic_growth_rate,
    NEW.risk_score, NEW.outlook, NEW.confidence, NEW.data_quality_score, NEW.notes, NEW.source, NEW.recorded_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS market_data_history_trigger ON public.market_data;
CREATE TRIGGER market_data_history_trigger
  AFTER INSERT OR UPDATE ON public.market_data
  FOR EACH ROW EXECUTE FUNCTION public.market_data_history_trigger();

-- 4. External data ingestion sources
CREATE TABLE IF NOT EXISTS public.market_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_class text NOT NULL,
  country text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  url text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  headers jsonb DEFAULT '{}'::jsonb,
  record_path text,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule text,
  is_active boolean NOT NULL DEFAULT false,
  last_fetched_at timestamp with time zone,
  last_status text,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_data_sources_active
  ON public.market_data_sources (is_active, asset_class);

COMMENT ON TABLE public.market_data_sources IS 'Configurable external data feeds for market intelligence refresh';

-- 5. RLS policies
ALTER TABLE public.market_data_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Market data history is readable by everyone"
  ON public.market_data_history
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Market data history is editable by admins"
  ON public.market_data_history
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

CREATE POLICY IF NOT EXISTS "Market data sources are readable by admins"
  ON public.market_data_sources
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

CREATE POLICY IF NOT EXISTS "Market data sources are editable by admins"
  ON public.market_data_sources
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

-- 6. Seed a sample inactive source to demonstrate the ingestion architecture
INSERT INTO public.market_data_sources
  (name, asset_class, country, url, record_path, field_mapping, schedule, is_active)
VALUES
  (
    'Sample Public Market Feed',
    'realEstate',
    'SA',
    'https://api.example.com/market/real-estate',
    'data.records',
    '{"averageSellingPrice":"price", "transactionCount":"volume", "demandIndex":"demand", "supplyIndex":"supply"}'::jsonb,
    '0 6 * * *',
    false
  )
ON CONFLICT (id) DO NOTHING;
-- BONDS Market Intelligence Engine — production-ready external data sources
-- These sources are public, unauthenticated, and feed macro / real-estate indicators.

-- Remove the placeholder sample source
DELETE FROM public.market_data_sources WHERE name = 'Sample Public Market Feed';

-- KAPSARC Saudi Real Estate Price Index (free API, no key)
INSERT INTO public.market_data_sources
  (name, asset_class, country, url, record_path, field_mapping, schedule, is_active)
VALUES
  (
    'KAPSARC Saudi RE Index — General',
    'realEstate',
    'SA',
    'https://datasource.kapsarc.org/api/explore/v2.1/catalog/datasets/real-estate-indices/records?limit=1&order_by=year%20desc&where=indicator%3D%27General%20index%27',
    'results',
    '{"averageSellingPrice":"value", "sector":"indicator"}'::jsonb,
    '0 6 1 * *',
    true
  ),
  (
    'KAPSARC Saudi RE Index — Residential Building',
    'realEstate',
    'SA',
    'https://datasource.kapsarc.org/api/explore/v2.1/catalog/datasets/real-estate-indices/records?limit=1&order_by=year%20desc&where=indicator%3D%27Residential%3A%20Building%27',
    'results',
    '{"averageSellingPrice":"value", "sector":"indicator"}'::jsonb,
    '0 6 1 * *',
    true
  ),
  (
    'KAPSARC Saudi RE Index — Commercial Building',
    'realEstate',
    'SA',
    'https://datasource.kapsarc.org/api/explore/v2.1/catalog/datasets/real-estate-indices/records?limit=1&order_by=year%20desc&where=indicator%3D%27Commercial%3A%20Building%27',
    'results',
    '{"averageSellingPrice":"value", "sector":"indicator"}'::jsonb,
    '0 6 1 * *',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- KAPSARC Saudi monetary indicators (repo rate RR)
INSERT INTO public.market_data_sources
  (name, asset_class, country, url, record_path, field_mapping, schedule, is_active)
VALUES
  (
    'KAPSARC Saudi Repo Rate (RR)',
    'realEstate',
    'SA',
    'https://datasource.kapsarc.org/api/explore/v2.1/catalog/datasets/interest-rates-and-sama-average-bills/records?limit=1&order_by=year%20desc&where=indicator%3D%27RR%27',
    'results',
    '{"interestRate":"interest_rate", "sector":"indicator"}'::jsonb,
    '0 6 1 * *',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- World Bank macro indicators (free API, no key)
INSERT INTO public.market_data_sources
  (name, asset_class, country, url, record_path, field_mapping, schedule, is_active)
VALUES
  (
    'World Bank — Saudi Inflation (CPI)',
    'realEstate',
    'SA',
    'https://api.worldbank.org/v2/country/SA/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024',
    '[1]',
    '{"inflationRate":"value"}'::jsonb,
    '0 6 1 * *',
    true
  ),
  (
    'World Bank — Saudi GDP Growth',
    'business',
    'SA',
    'https://api.worldbank.org/v2/country/SA/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024',
    '[1]',
    '{"economicGrowthRate":"value"}'::jsonb,
    '0 6 1 * *',
    true
  )
ON CONFLICT (id) DO NOTHING;
-- BONDS Market Intelligence Engine — macro indicators for all 22 Arab countries
-- Sources: World Bank Open Data (free, no API key required)

DELETE FROM public.market_data_sources WHERE name LIKE 'World Bank — %';

INSERT INTO public.market_data_sources
  (name, asset_class, country, url, record_path, field_mapping, schedule, is_active)
VALUES
  -- Inflation (CPI) per country
  ('World Bank — UAE Inflation (CPI)', 'realEstate', 'AE', 'https://api.worldbank.org/v2/country/AE/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Bahrain Inflation (CPI)', 'realEstate', 'BH', 'https://api.worldbank.org/v2/country/BH/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Algeria Inflation (CPI)', 'realEstate', 'DZ', 'https://api.worldbank.org/v2/country/DZ/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Egypt Inflation (CPI)', 'realEstate', 'EG', 'https://api.worldbank.org/v2/country/EG/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Iraq Inflation (CPI)', 'realEstate', 'IQ', 'https://api.worldbank.org/v2/country/IQ/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Jordan Inflation (CPI)', 'realEstate', 'JO', 'https://api.worldbank.org/v2/country/JO/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Kuwait Inflation (CPI)', 'realEstate', 'KW', 'https://api.worldbank.org/v2/country/KW/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Lebanon Inflation (CPI)', 'realEstate', 'LB', 'https://api.worldbank.org/v2/country/LB/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Libya Inflation (CPI)', 'realEstate', 'LY', 'https://api.worldbank.org/v2/country/LY/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Morocco Inflation (CPI)', 'realEstate', 'MA', 'https://api.worldbank.org/v2/country/MA/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Oman Inflation (CPI)', 'realEstate', 'OM', 'https://api.worldbank.org/v2/country/OM/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Palestine Inflation (CPI)', 'realEstate', 'PS', 'https://api.worldbank.org/v2/country/PS/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Qatar Inflation (CPI)', 'realEstate', 'QA', 'https://api.worldbank.org/v2/country/QA/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Saudi Arabia Inflation (CPI)', 'realEstate', 'SA', 'https://api.worldbank.org/v2/country/SA/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Sudan Inflation (CPI)', 'realEstate', 'SD', 'https://api.worldbank.org/v2/country/SD/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Syria Inflation (CPI)', 'realEstate', 'SY', 'https://api.worldbank.org/v2/country/SY/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Tunisia Inflation (CPI)', 'realEstate', 'TN', 'https://api.worldbank.org/v2/country/TN/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Yemen Inflation (CPI)', 'realEstate', 'YE', 'https://api.worldbank.org/v2/country/YE/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Djibouti Inflation (CPI)', 'realEstate', 'DJ', 'https://api.worldbank.org/v2/country/DJ/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Somalia Inflation (CPI)', 'realEstate', 'SO', 'https://api.worldbank.org/v2/country/SO/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Mauritania Inflation (CPI)', 'realEstate', 'MR', 'https://api.worldbank.org/v2/country/MR/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Comoros Inflation (CPI)', 'realEstate', 'KM', 'https://api.worldbank.org/v2/country/KM/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2024', '[1]', '{"inflationRate":"value"}'::jsonb, '0 6 1 * *', true),

  -- GDP growth per country
  ('World Bank — UAE GDP Growth', 'business', 'AE', 'https://api.worldbank.org/v2/country/AE/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Bahrain GDP Growth', 'business', 'BH', 'https://api.worldbank.org/v2/country/BH/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Algeria GDP Growth', 'business', 'DZ', 'https://api.worldbank.org/v2/country/DZ/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Egypt GDP Growth', 'business', 'EG', 'https://api.worldbank.org/v2/country/EG/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Iraq GDP Growth', 'business', 'IQ', 'https://api.worldbank.org/v2/country/IQ/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Jordan GDP Growth', 'business', 'JO', 'https://api.worldbank.org/v2/country/JO/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Kuwait GDP Growth', 'business', 'KW', 'https://api.worldbank.org/v2/country/KW/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Lebanon GDP Growth', 'business', 'LB', 'https://api.worldbank.org/v2/country/LB/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Libya GDP Growth', 'business', 'LY', 'https://api.worldbank.org/v2/country/LY/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Morocco GDP Growth', 'business', 'MA', 'https://api.worldbank.org/v2/country/MA/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Oman GDP Growth', 'business', 'OM', 'https://api.worldbank.org/v2/country/OM/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Palestine GDP Growth', 'business', 'PS', 'https://api.worldbank.org/v2/country/PS/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Qatar GDP Growth', 'business', 'QA', 'https://api.worldbank.org/v2/country/QA/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Saudi Arabia GDP Growth', 'business', 'SA', 'https://api.worldbank.org/v2/country/SA/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Sudan GDP Growth', 'business', 'SD', 'https://api.worldbank.org/v2/country/SD/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Syria GDP Growth', 'business', 'SY', 'https://api.worldbank.org/v2/country/SY/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Tunisia GDP Growth', 'business', 'TN', 'https://api.worldbank.org/v2/country/TN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Yemen GDP Growth', 'business', 'YE', 'https://api.worldbank.org/v2/country/YE/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Djibouti GDP Growth', 'business', 'DJ', 'https://api.worldbank.org/v2/country/DJ/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Somalia GDP Growth', 'business', 'SO', 'https://api.worldbank.org/v2/country/SO/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Mauritania GDP Growth', 'business', 'MR', 'https://api.worldbank.org/v2/country/MR/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true),
  ('World Bank — Comoros GDP Growth', 'business', 'KM', 'https://api.worldbank.org/v2/country/KM/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1&date=2024', '[1]', '{"economicGrowthRate":"value"}'::jsonb, '0 6 1 * *', true)
ON CONFLICT (id) DO NOTHING;
