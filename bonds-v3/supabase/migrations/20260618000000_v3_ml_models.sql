-- Bonds V3 — Simple ML regression models storage
-- Stores trained linear-regression coefficients for market-size / demand estimation.

CREATE TABLE IF NOT EXISTS public.ml_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL,
  feature_key text NOT NULL,
  country_code text,
  slope numeric NOT NULL,
  intercept numeric NOT NULL,
  r_squared numeric NOT NULL DEFAULT 0,
  sample_count int NOT NULL DEFAULT 0,
  feature_stats jsonb NOT NULL DEFAULT '{}',
  trained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_code, feature_key, country_code)
);

CREATE INDEX IF NOT EXISTS idx_ml_models_metric
  ON public.ml_models(metric_code);
CREATE INDEX IF NOT EXISTS idx_ml_models_country
  ON public.ml_models(country_code);

ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read ML models"
  ON public.ml_models FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Service role can manage ML models"
  ON public.ml_models FOR ALL TO service_role USING (true) WITH CHECK (true);
