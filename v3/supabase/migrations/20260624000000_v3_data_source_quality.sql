-- Bonds V3 — Track reliability of external data sources over time

CREATE TABLE IF NOT EXISTS public.data_source_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  year int NOT NULL,
  metric_code TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  count int,
  confidence int CHECK (confidence BETWEEN 0 AND 100),
  source_method TEXT,
  failure_reason TEXT,
  attempts int NOT NULL DEFAULT 0,
  successes int NOT NULL DEFAULT 0,
  last_attempted_at timestamptz NOT NULL DEFAULT NOW(),
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, city_id, activity_id, year, metric_code)
);

CREATE INDEX IF NOT EXISTS idx_data_source_quality_source
  ON public.data_source_quality(source_id);
CREATE INDEX IF NOT EXISTS idx_data_source_quality_city
  ON public.data_source_quality(city_id);
CREATE INDEX IF NOT EXISTS idx_data_source_quality_success
  ON public.data_source_quality(success, last_attempted_at DESC);

ALTER TABLE public.data_source_quality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage data source quality"
  ON public.data_source_quality FOR ALL TO service_role USING (true) WITH CHECK (true);
