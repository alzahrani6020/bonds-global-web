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
