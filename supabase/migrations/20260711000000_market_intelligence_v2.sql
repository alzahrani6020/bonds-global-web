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
