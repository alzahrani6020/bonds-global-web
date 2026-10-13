-- Country-level external observations for automated macro context.
-- Keeps national observations separate from city facts and preserves provenance.

CREATE TABLE IF NOT EXISTS public.country_indicator_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL CHECK (char_length(country_code) = 2),
  metric_code text NOT NULL,
  year int NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  value numeric,
  unit text,
  source_id text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at date,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  confidence int NOT NULL DEFAULT 90 CHECK (confidence BETWEEN 0 AND 100),
  geographic_scope text NOT NULL DEFAULT 'country' CHECK (geographic_scope IN ('country')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, metric_code, year, source_id)
);

CREATE INDEX IF NOT EXISTS idx_country_indicator_observations_country_year
  ON public.country_indicator_observations(country_code, year DESC);

CREATE INDEX IF NOT EXISTS idx_country_indicator_observations_metric
  ON public.country_indicator_observations(metric_code, country_code, year DESC);

ALTER TABLE public.country_indicator_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_indicator_observations_public_read" ON public.country_indicator_observations;
CREATE POLICY "country_indicator_observations_public_read"
  ON public.country_indicator_observations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "country_indicator_observations_service_write" ON public.country_indicator_observations;
CREATE POLICY "country_indicator_observations_service_write"
  ON public.country_indicator_observations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.country_indicator_observations IS
  'Traceable country-level observations from external sources; never presented as city-level facts.';
