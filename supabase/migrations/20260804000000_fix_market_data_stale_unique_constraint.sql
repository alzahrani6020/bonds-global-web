-- Fix: drop stale UNIQUE(asset_class, country, city) constraint on market_data.
--
-- The v1 migration (20260710000000_market_intelligence.sql) created the table with
-- UNIQUE(asset_class, country, city) -> constraint market_data_asset_class_country_city_key.
-- The v2 migration (20260711000000_market_intelligence_v2.sql) added the intended
-- 5-column dimensional unique index idx_market_data_unique_dims
-- (asset_class, country, region, city, sector) but never dropped the old constraint.
--
-- Result: upserts that legitimately differ in region/sector for the same
-- (asset_class, country, city) violate the stale 3-column constraint (23505),
-- causing daily refresh failures for several ingestion sources.

ALTER TABLE public.market_data
  DROP CONSTRAINT IF EXISTS market_data_asset_class_country_city_key;
