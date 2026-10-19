-- Bonds V3 — Country Context Core
-- Establishes one authoritative country profile layer for all 22 Arab countries.
-- Additive only: existing cities, models, regulations and canonical activities remain unchanged.

CREATE TABLE IF NOT EXISTS public.country_profiles (
  country_code text PRIMARY KEY CHECK (char_length(country_code) = 2),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  currency_code text NOT NULL CHECK (char_length(currency_code) = 3),
  currency_symbol text,
  locale_ar text NOT NULL,
  locale_en text NOT NULL,
  default_language text NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar','en')),
  timezone text,
  is_supported boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  fallback_policy text NOT NULL DEFAULT 'no_cross_country_fallback'
    CHECK (fallback_policy IN ('no_cross_country_fallback','explicit_estimate_only')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canonical_activity_country (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_activity_id uuid NOT NULL
    REFERENCES public.canonical_activities(id) ON DELETE CASCADE,
  country_code text NOT NULL
    REFERENCES public.country_profiles(country_code) ON DELETE CASCADE,
  availability_status text NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('unknown','available','restricted','unavailable')),
  classification_system text,
  classification_code text,
  classification_label text,
  regulatory_status text NOT NULL DEFAULT 'unknown'
    CHECK (regulatory_status IN ('unknown','unverified','partial','verified')),
  source text,
  source_url text,
  confidence integer CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  valid_from date,
  valid_until date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_activity_id, country_code)
);

CREATE TABLE IF NOT EXISTS public.country_model_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_model_id uuid NOT NULL
    REFERENCES public.project_models(id) ON DELETE CASCADE,
  country_code text NOT NULL
    REFERENCES public.country_profiles(country_code) ON DELETE CASCADE,
  currency_code text NOT NULL CHECK (char_length(currency_code) = 3),
  status text NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified','estimated','verified')),
  capex_min numeric,
  capex_max numeric,
  revenue_min numeric,
  revenue_max numeric,
  land_cost_min numeric,
  land_cost_avg numeric,
  land_cost_max numeric,
  construction_cost_per_sqm numeric,
  equipment_cost_min numeric,
  equipment_cost_avg numeric,
  equipment_cost_max numeric,
  monthly_operation_cost_min numeric,
  monthly_operation_cost_avg numeric,
  monthly_operation_cost_max numeric,
  salary_factor numeric,
  rent_factor numeric,
  utilities_factor numeric,
  inflation_rate numeric,
  financing_rate numeric,
  tax_rate numeric,
  source text,
  source_url text,
  confidence integer CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  valid_from date,
  valid_until date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_model_id, country_code)
);

CREATE TABLE IF NOT EXISTS public.country_regulatory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL
    REFERENCES public.country_profiles(country_code) ON DELETE CASCADE,
  canonical_activity_id uuid
    REFERENCES public.canonical_activities(id) ON DELETE CASCADE,
  legacy_requirement_id uuid
    REFERENCES public.regulatory_requirements(id) ON DELETE SET NULL,
  requirement_name_ar text NOT NULL,
  requirement_name_en text,
  issuing_authority text,
  requirement_type text,
  mandatory boolean NOT NULL DEFAULT true,
  estimated_cost numeric,
  currency_code text CHECK (currency_code IS NULL OR char_length(currency_code) = 3),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','partial','verified')),
  source text,
  source_url text,
  confidence integer CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  valid_from date,
  valid_until date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_activity_country_country
  ON public.canonical_activity_country(country_code, availability_status);

CREATE INDEX IF NOT EXISTS idx_country_model_overrides_country
  ON public.country_model_overrides(country_code, status);

CREATE INDEX IF NOT EXISTS idx_country_regulatory_requirements_country
  ON public.country_regulatory_requirements(country_code, verification_status);

CREATE INDEX IF NOT EXISTS idx_country_regulatory_requirements_activity
  ON public.country_regulatory_requirements(canonical_activity_id);

INSERT INTO public.country_profiles
(country_code, name_ar, name_en, currency_code, currency_symbol, locale_ar, locale_en, timezone)
VALUES
('DZ','الجزائر','Algeria','DZD','د.ج','ar-DZ','en-DZ','Africa/Algiers'),
('BH','البحرين','Bahrain','BHD','د.ب','ar-BH','en-BH','Asia/Bahrain'),
('KM','جزر القمر','Comoros','KMF','ف.ق','ar-KM','en-KM','Indian/Comoro'),
('DJ','جيبوتي','Djibouti','DJF','ف.ج','ar-DJ','en-DJ','Africa/Djibouti'),
('EG','مصر','Egypt','EGP','ج.م','ar-EG','en-EG','Africa/Cairo'),
('IQ','العراق','Iraq','IQD','د.ع','ar-IQ','en-IQ','Asia/Baghdad'),
('JO','الأردن','Jordan','JOD','د.أ','ar-JO','en-JO','Asia/Amman'),
('KW','الكويت','Kuwait','KWD','د.ك','ar-KW','en-KW','Asia/Kuwait'),
('LB','لبنان','Lebanon','LBP','ل.ل','ar-LB','en-LB','Asia/Beirut'),
('LY','ليبيا','Libya','LYD','د.ل','ar-LY','en-LY','Africa/Tripoli'),
('MR','موريتانيا','Mauritania','MRU','أ.م','ar-MR','en-MR','Africa/Nouakchott'),
('MA','المغرب','Morocco','MAD','د.م','ar-MA','en-MA','Africa/Casablanca'),
('OM','عُمان','Oman','OMR','ر.ع','ar-OM','en-OM','Asia/Muscat'),
('PS','فلسطين','Palestine','USD','$','ar-PS','en-PS','Asia/Hebron'),
('QA','قطر','Qatar','QAR','ر.ق','ar-QA','en-QA','Asia/Qatar'),
('SA','السعودية','Saudi Arabia','SAR','ر.س','ar-SA','en-SA','Asia/Riyadh'),
('SO','الصومال','Somalia','SOS','ش.ص','ar-SO','en-SO','Africa/Mogadishu'),
('SD','السودان','Sudan','SDG','ج.س','ar-SD','en-SD','Africa/Khartoum'),
('SY','سوريا','Syria','SYP','ل.س','ar-SY','en-SY','Asia/Damascus'),
('TN','تونس','Tunisia','TND','د.ت','ar-TN','en-TN','Africa/Tunis'),
('AE','الإمارات','United Arab Emirates','AED','د.إ','ar-AE','en-AE','Asia/Dubai'),
('YE','اليمن','Yemen','YER','ر.ي','ar-YE','en-YE','Asia/Aden')
ON CONFLICT (country_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  locale_ar = EXCLUDED.locale_ar,
  locale_en = EXCLUDED.locale_en,
  timezone = EXCLUDED.timezone,
  updated_at = now();

-- Create an explicit coverage row for every canonical activity × supported country.
-- Unknown means exactly unknown; it must never be interpreted as unavailable or available.
INSERT INTO public.canonical_activity_country (canonical_activity_id, country_code)
SELECT ca.id, cp.country_code
FROM public.canonical_activities ca
CROSS JOIN public.country_profiles cp
WHERE cp.is_supported = true
ON CONFLICT (canonical_activity_id, country_code) DO NOTHING;

ALTER TABLE public.country_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_activity_country ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_model_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_regulatory_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read country profiles" ON public.country_profiles;
CREATE POLICY "Public read country profiles"
  ON public.country_profiles FOR SELECT TO PUBLIC USING (is_active = true);

DROP POLICY IF EXISTS "Public read activity country coverage" ON public.canonical_activity_country;
CREATE POLICY "Public read activity country coverage"
  ON public.canonical_activity_country FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Public read country model overrides" ON public.country_model_overrides;
CREATE POLICY "Public read country model overrides"
  ON public.country_model_overrides FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Public read country regulations" ON public.country_regulatory_requirements;
CREATE POLICY "Public read country regulations"
  ON public.country_regulatory_requirements FOR SELECT TO PUBLIC USING (true);

COMMENT ON TABLE public.country_profiles IS
  'Authoritative runtime context for each of the 22 supported Arab countries.';
COMMENT ON TABLE public.canonical_activity_country IS
  'Country applicability/classification overlay for canonical economic activities. Unknown never implies unavailable.';
COMMENT ON TABLE public.country_model_overrides IS
  'Country-specific financial override layer for shared project models; avoids cloning a model 22 times.';
COMMENT ON TABLE public.country_regulatory_requirements IS
  'Country-scoped regulatory requirements; legacy unscoped regulations remain untouched until verified.';
