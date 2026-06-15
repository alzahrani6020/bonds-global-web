-- Bonds V3 — Fix ml_models schema for multivariate regression storage.
-- The old simple-regression columns (slope/intercept) are no longer required
-- because RegressionEstimator now stores weights/feature statistics.

ALTER TABLE public.ml_models
  ALTER COLUMN slope DROP NOT NULL,
  ALTER COLUMN intercept DROP NOT NULL;

-- Ensure the multivariate columns exist (added in 20260619).
ALTER TABLE public.ml_models
  ADD COLUMN IF NOT EXISTS model_type text NOT NULL DEFAULT 'linear',
  ADD COLUMN IF NOT EXISTS weights jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS feature_means jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feature_stds jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_mean numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rmse numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mape numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ml_models_type
  ON public.ml_models(model_type);
