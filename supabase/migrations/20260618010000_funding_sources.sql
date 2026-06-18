-- ============================================
-- Funding Sources Directory
-- Banks, Funds, Investors, Government Programs
-- ============================================

CREATE TABLE IF NOT EXISTS public.funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bank', 'fund', 'investor', 'government_program')),
  name_ar text NOT NULL,
  name_en text,
  country_code text NOT NULL DEFAULT 'SA',
  sector text, -- comma-separated or single sector; filterable
  description text,
  eligibility text,
  min_amount numeric,
  max_amount numeric,
  currency text NOT NULL DEFAULT 'SAR',
  interest_rate text, -- e.g. "5% - 8%" or "profit sharing"
  tenure text,        -- e.g. "up to 7 years"
  financing_type text, -- e.g. "loan", "equity", "grant", "guarantee"
  website text,
  email text,
  phone text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.funding_sources IS 'Directory of banks, funds, investors and government financing programs';

ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active funding sources" ON public.funding_sources;
CREATE POLICY "Anyone can read active funding sources"
  ON public.funding_sources FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage funding sources" ON public.funding_sources;
CREATE POLICY "Service role can manage funding sources"
  ON public.funding_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage funding sources" ON public.funding_sources;
CREATE POLICY "Admins can manage funding sources"
  ON public.funding_sources FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  ));

CREATE INDEX IF NOT EXISTS idx_funding_sources_country ON public.funding_sources(country_code);
CREATE INDEX IF NOT EXISTS idx_funding_sources_type ON public.funding_sources(type);
CREATE INDEX IF NOT EXISTS idx_funding_sources_sector ON public.funding_sources USING gin (to_tsvector('simple', COALESCE(sector, '')));
CREATE INDEX IF NOT EXISTS idx_funding_sources_active ON public.funding_sources(is_active, is_featured, sort_order);

DROP TRIGGER IF EXISTS trg_funding_sources_updated_at ON public.funding_sources;
CREATE TRIGGER trg_funding_sources_updated_at
  BEFORE UPDATE ON public.funding_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed sample data (Saudi Arabia examples; safe to re-run with ON CONFLICT)
INSERT INTO public.funding_sources (
  type, name_ar, name_en, country_code, sector, description, eligibility,
  min_amount, max_amount, currency, interest_rate, tenure, financing_type,
  website, is_active, is_featured, sort_order
) VALUES
(
  'government_program', 'برنامج كفالة', 'Kafala Program', 'SA', 'all',
  'برنامج ضمان التمويل للمنشآت الصغيرة والمتوسطة من وزارة المالية السعودية.',
  'منشآت صغيرة ومتوسطة مسجلة لدى الجهات الرسمية، قائمة على الأعمال لمدة لا تقل عن سنة.',
  10000, 2000000, 'SAR', 'يحدده البنك الممول', 'حتى 7 سنوات', 'guarantee',
  'https://kafala.gov.sa', true, true, 1
),
(
  'bank', 'البنك الأهلي السعودي', 'Saudi National Bank (SNB)', 'SA', 'all',
  'تمويل الشركات والمنشآت الصغيرة والمتوسطة مع حلول متنوعة.',
  'شركات ومنشآت مسجلة، مالية سليمة، ضمانات مناسبة.',
  50000, 50000000, 'SAR', 'SAMArepo + margin', '1 - 10 سنوات', 'loan',
  'https://www.alahli.com', true, true, 2
),
(
  'fund', 'صندوق رأس المال الجريء — Monshaat', 'Monshaat VC Fund', 'SA', 'technology,manufacturing',
  'استثمارات في الشركات الناشئة والمتوسطة في قطاعات التقنية والصناعة.',
  'شركات ناشئة أو متوسطة ذات نموذج عمل قابل للتوسع وفريق تنفيذي قوي.',
  500000, 10000000, 'SAR', 'equity stake', '3 - 7 سنوات', 'equity',
  'https://www.monshaat.gov.sa', true, false, 3
),
(
  'investor', 'مجموعة مستثمرين أنجال — Angel Investors Saudi', 'Angel Investors Saudi', 'SA', 'technology,food,healthcare',
  'شبكة مستثمرين أفراد لدعم الشركات الناشئة في مراحلها المبكرة.',
  'شركات ناشئة في مرحلة ما قبل التأسيس أو Series A مع MVP واضح.',
  100000, 2000000, 'SAR', 'equity or convertible note', '2 - 5 سنوات', 'equity',
  'https://angelinvestors.sa', true, false, 4
)
ON CONFLICT DO NOTHING;
