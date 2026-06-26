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
