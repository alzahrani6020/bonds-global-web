-- ============================================
-- Site Settings & Usage Exceptions
-- للتحكم في الحدود والأسعار واستثناءات العملاء
-- ============================================

-- Global settings (limits, prices, etc.)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Usage exceptions for specific users
CREATE TABLE IF NOT EXISTS public.usage_exceptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  calculator text NOT NULL DEFAULT 'all', -- 'all' or specific calculator
  limit_override integer NOT NULL DEFAULT 9999,
  reason text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
  ('calc_limit', '3'),
  ('feas_limit', '1'),
  ('price_pro_sar', '82'),
  ('price_enterprise_sar', '212')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.site_settings IS 'إعدادات الموقع العامة';
COMMENT ON TABLE public.usage_exceptions IS 'استثناءات استخدام لعملاء محددين';

-- RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_exceptions ENABLE ROW LEVEL SECURITY;

-- Service role can manage
CREATE POLICY "Service role can manage site_settings"
  ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage usage_exceptions"
  ON public.usage_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public read for settings (needed by frontend)
CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT USING (true);

-- Block public access to exceptions
CREATE POLICY "Block public access to exceptions"
  ON public.usage_exceptions FOR SELECT USING (false);
