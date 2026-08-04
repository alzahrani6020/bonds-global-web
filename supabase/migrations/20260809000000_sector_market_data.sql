-- ============================================
-- Generic Sector Market Data Table
-- Stores editable market benchmarks per sector/country
-- for all investment-center calculators.
-- ============================================

CREATE TABLE IF NOT EXISTS public.sector_market_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_code TEXT NOT NULL,
  country_code VARCHAR(4) NOT NULL,
  country_name_ar TEXT,
  country_name_en TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sector_code, country_code)
);

COMMENT ON TABLE public.sector_market_data IS 'Editable market and regulatory data per sector and country for investment calculators';

CREATE INDEX IF NOT EXISTS idx_sector_market_data_lookup ON public.sector_market_data(sector_code, country_code);
CREATE INDEX IF NOT EXISTS idx_sector_market_data_active ON public.sector_market_data(is_active);
CREATE INDEX IF NOT EXISTS idx_sector_market_data_updated ON public.sector_market_data(updated_at);

ALTER TABLE public.sector_market_data ENABLE ROW LEVEL SECURITY;

-- Anyone can read active data (public endpoint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sector_market_data' AND policyname = 'public_read_sector_market_data'
  ) THEN
    CREATE POLICY public_read_sector_market_data ON public.sector_market_data
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END
$$;

-- Only service role can write (admin updates go through API with service key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sector_market_data' AND policyname = 'service_write_sector_market_data'
  ) THEN
    CREATE POLICY service_write_sector_market_data ON public.sector_market_data
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_sector_market_data_updated_at()
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
    WHERE tgname = 'trg_sector_market_data_updated_at'
    AND tgrelid = 'public.sector_market_data'::regclass
  ) THEN
    CREATE TRIGGER trg_sector_market_data_updated_at
      BEFORE UPDATE ON public.sector_market_data
      FOR EACH ROW EXECUTE FUNCTION public.update_sector_market_data_updated_at();
  END IF;
END
$$;
