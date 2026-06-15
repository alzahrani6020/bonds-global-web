-- Bonds V3 — City-level competitor calibration table.
-- Stores raw Geoapify counts and country-calibrated values so the CompetitionEngine
-- can use realistic competitor numbers even when open-data POI coverage is sparse.

CREATE TABLE IF NOT EXISTS public.city_competitor_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  metric_code text NOT NULL DEFAULT 'competitors_count',
  year int NOT NULL,
  raw_value numeric,
  calibrated_value numeric NOT NULL,
  factor numeric,
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city_id, activity_id, metric_code, year)
);

CREATE INDEX IF NOT EXISTS idx_city_competitor_calibration_lookup
  ON public.city_competitor_calibration(city_id, activity_id, metric_code, year);
CREATE INDEX IF NOT EXISTS idx_city_competitor_calibration_activity_year
  ON public.city_competitor_calibration(activity_id, metric_code, year);

ALTER TABLE public.city_competitor_calibration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read city competitor calibration"
  ON public.city_competitor_calibration FOR SELECT TO anon, authenticated, service_role USING (true);
CREATE POLICY "Service role can manage city competitor calibration"
  ON public.city_competitor_calibration FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS city_competitor_calibration_updated_at ON public.city_competitor_calibration;
CREATE TRIGGER city_competitor_calibration_updated_at
  BEFORE UPDATE ON public.city_competitor_calibration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
