-- Bonds V3 — Monetary currency provenance
-- Prevents monetary values from being relabeled as the selected country's currency
-- when their actual stored unit is SAR or is not yet known.

ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS currency_code text
  CHECK (currency_code IS NULL OR char_length(currency_code) = 3);

ALTER TABLE public.city_indicators
  ADD COLUMN IF NOT EXISTS currency_code text
  CHECK (currency_code IS NULL OR char_length(currency_code) = 3);

-- These generation pipelines explicitly calculate monetary values in SAR,
-- including rows generated for non-Saudi cities.
UPDATE public.city_market_data
SET currency_code = 'SAR'
WHERE currency_code IS NULL
  AND source IN (
    'economic_model_population_weighted',
    'key_city_economic_model',
    'key_city_enriched_estimate',
    'country_average_estimate',
    'Bonds market dataset'
  );

-- Saudi rows are natively SAR even when an older source label is absent.
UPDATE public.city_market_data m
SET currency_code = 'SAR'
FROM public.cities c
WHERE c.id = m.city_id
  AND c.country_code = 'SA'
  AND m.currency_code IS NULL;

-- Existing city indicator rows do not have reliable currency provenance outside
-- Saudi Arabia. Mark only Saudi rows; leave other countries NULL rather than
-- falsely labeling mixed/estimated units as local currency.
UPDATE public.city_indicators ci
SET currency_code = 'SAR'
FROM public.cities c
WHERE c.id = ci.city_id
  AND c.country_code = 'SA'
  AND ci.currency_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_city_market_data_currency
  ON public.city_market_data(currency_code);

COMMENT ON COLUMN public.city_market_data.currency_code IS
  'Currency of monetary fields in this row. NULL means the stored monetary unit is not verified.';
COMMENT ON COLUMN public.city_indicators.currency_code IS
  'Currency of monetary indicator fields. NULL means currency provenance is not verified.';
