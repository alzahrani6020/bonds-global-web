-- Bonds V3 — Official country-level statistics from national bureaus, World Bank, IMF

CREATE TABLE IF NOT EXISTS public.official_country_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  metric_code TEXT NOT NULL,
  value NUMERIC,
  value_text TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  confidence INTEGER NOT NULL DEFAULT 90,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code, year, metric_code)
);

COMMENT ON TABLE public.official_country_data IS 'Official country-level statistics used as ground truth for city indicator estimation';

CREATE INDEX IF NOT EXISTS idx_official_country_data_lookup ON public.official_country_data(country_code, year, metric_code);

DROP TRIGGER IF EXISTS official_country_data_updated_at ON public.official_country_data;
CREATE TRIGGER official_country_data_updated_at
  BEFORE UPDATE ON public.official_country_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
