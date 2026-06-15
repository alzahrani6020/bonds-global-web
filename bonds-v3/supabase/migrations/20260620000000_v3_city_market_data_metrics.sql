-- Bonds V3 — Add missing activity metrics to city_market_data
-- Required by the data fusion pipeline for labor, competition, and pricing engines.

ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS specialists_count INTEGER,
  ADD COLUMN IF NOT EXISTS saudization_rate INTEGER CHECK (saudization_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS profit_margin_min NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS profit_margin_avg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS profit_margin_max NUMERIC(5,2);
