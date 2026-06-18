-- Bonds V3 — Enhance alerts with smart insight and detection timestamp
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS insight text,
  ADD COLUMN IF NOT EXISTS detected_at timestamptz NOT NULL DEFAULT now();

-- Backfill detected_at for existing rows
UPDATE public.alerts SET detected_at = created_at WHERE detected_at = created_at AND created_at IS NOT NULL;

-- Helpful index for deduplication by rule + entity + metric + time window
CREATE INDEX IF NOT EXISTS idx_alerts_dedup
  ON public.alerts(rule_id, city_id, activity_id, metric_code, created_at DESC);
