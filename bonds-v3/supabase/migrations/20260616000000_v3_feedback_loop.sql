-- Bonds V3 — Feedback Loop
-- Stores actual values compared to estimates to improve inference models over time.

CREATE TABLE IF NOT EXISTS public.metric_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL REFERENCES public.metric_definitions(code) ON DELETE RESTRICT,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  year int NOT NULL,
  estimated_value numeric,
  estimated_value_text text,
  actual_value numeric,
  actual_value_text text,
  project_id uuid REFERENCES public.user_projects(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'admin', 'audit', 'external')),
  confidence int CHECK (confidence BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_feedback_metric_code
  ON public.metric_feedback(metric_code);
CREATE INDEX IF NOT EXISTS idx_metric_feedback_city_id
  ON public.metric_feedback(city_id);
CREATE INDEX IF NOT EXISTS idx_metric_feedback_activity_id
  ON public.metric_feedback(activity_id);
CREATE INDEX IF NOT EXISTS idx_metric_feedback_year
  ON public.metric_feedback(year);
CREATE INDEX IF NOT EXISTS idx_metric_feedback_city_activity_year
  ON public.metric_feedback(city_id, activity_id, year);

-- View to compute average error per metric/city/activity
CREATE OR REPLACE VIEW public.metric_feedback_accuracy AS
SELECT
  metric_code,
  city_id,
  activity_id,
  year,
  COUNT(*) AS feedback_count,
  AVG(actual_value - estimated_value) AS mean_error,
  AVG(
    CASE
      WHEN estimated_value <> 0 THEN (actual_value - estimated_value) / estimated_value
      ELSE NULL
    END
  ) * 100 AS mean_percentage_error,
  AVG(actual_value) AS actual_avg,
  AVG(estimated_value) AS estimated_avg
FROM public.metric_feedback
WHERE actual_value IS NOT NULL AND estimated_value IS NOT NULL
GROUP BY metric_code, city_id, activity_id, year;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS metric_feedback_updated_at ON public.metric_feedback;
CREATE TRIGGER metric_feedback_updated_at
  BEFORE UPDATE ON public.metric_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.metric_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read metric feedback"
  ON public.metric_feedback FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "Authenticated users can insert own feedback"
  ON public.metric_feedback FOR INSERT
  TO authenticated
  WITH CHECK (source = 'user');

CREATE POLICY "Service role can manage metric feedback"
  ON public.metric_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
