-- Bonds V3 — Golden Opportunity Score, Investment Map & AI Chat support
-- Adds opportunity scoring columns and city coordinates for the map.

ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS opportunity_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS opportunity_rank INTEGER;

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7);

CREATE INDEX IF NOT EXISTS idx_city_market_data_opportunity_score
  ON public.city_market_data(opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_city_market_data_opportunity_rank
  ON public.city_market_data(opportunity_rank ASC);

-- Optional metadata column for score breakdown (kept flexible via JSONB)
ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS opportunity_breakdown JSONB DEFAULT '{}'::jsonb;
