-- Bonds V3 — Enhanced ML models storage
-- Adds multivariate regression support and evaluation metrics.

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
