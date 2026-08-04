-- ============================================
-- Water Factory Market Data Table
-- Stores editable market benchmarks per country
-- for the water-factory investment calculator.
-- ============================================

CREATE TABLE IF NOT EXISTS public.water_factory_market_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code VARCHAR(4) NOT NULL UNIQUE,
  country_name_ar TEXT,
  country_name_en TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.water_factory_market_data IS 'Editable market and regulatory data for the water factory calculator per country';

CREATE INDEX IF NOT EXISTS idx_water_factory_market_data_country ON public.water_factory_market_data(country_code);
CREATE INDEX IF NOT EXISTS idx_water_factory_market_data_active ON public.water_factory_market_data(is_active);

ALTER TABLE public.water_factory_market_data ENABLE ROW LEVEL SECURITY;

-- Anyone can read active data (public endpoint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'water_factory_market_data' AND policyname = 'public_read_water_factory_market_data'
  ) THEN
    CREATE POLICY public_read_water_factory_market_data ON public.water_factory_market_data
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END
$$;

-- Only service role can write (admin updates go through API with service key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'water_factory_market_data' AND policyname = 'service_write_water_factory_market_data'
  ) THEN
    CREATE POLICY service_write_water_factory_market_data ON public.water_factory_market_data
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_water_factory_market_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_water_factory_market_data_updated_at'
    AND tgrelid = 'public.water_factory_market_data'::regclass
  ) THEN
    CREATE TRIGGER trg_water_factory_market_data_updated_at
      BEFORE UPDATE ON public.water_factory_market_data
      FOR EACH ROW EXECUTE FUNCTION public.update_water_factory_market_data_updated_at();
  END IF;
END
$$;
