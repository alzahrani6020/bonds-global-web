-- Bonds V3 — User feedback table for city/market data corrections

CREATE TABLE IF NOT EXISTS public.data_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.economic_activities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  metric_code TEXT NOT NULL,
  current_value NUMERIC,
  suggested_value NUMERIC NOT NULL,
  reason TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_feedback IS 'User-submitted corrections for city indicators and market data';

CREATE INDEX IF NOT EXISTS idx_data_feedback_city_id ON public.data_feedback(city_id);
CREATE INDEX IF NOT EXISTS idx_data_feedback_status ON public.data_feedback(status);
CREATE INDEX IF NOT EXISTS idx_data_feedback_metric ON public.data_feedback(metric_code, year);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_feedback_updated_at ON public.data_feedback;
CREATE TRIGGER data_feedback_updated_at
  BEFORE UPDATE ON public.data_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Confidence log table to track why confidence changed
CREATE TABLE IF NOT EXISTS public.confidence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.economic_activities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  metric_code TEXT,
  old_confidence INTEGER,
  new_confidence INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confidence_log_city ON public.confidence_log(city_id, year);
