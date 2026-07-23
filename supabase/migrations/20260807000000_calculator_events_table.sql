-- Calculator events table for anonymous-first UX analytics
-- Stores anonymous and authenticated calculator interactions for conversion dashboard.

CREATE TABLE IF NOT EXISTS public.calculator_events (
  id BIGSERIAL PRIMARY KEY,
  event VARCHAR(64) NOT NULL,
  calculator VARCHAR(64) NOT NULL,
  country VARCHAR(8),
  lang VARCHAR(8),
  session_id VARCHAR(64),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(32),
  duration_seconds INTEGER,
  properties JSONB DEFAULT '{}'::jsonb,
  url TEXT,
  ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calculator_events_event ON public.calculator_events(event);
CREATE INDEX IF NOT EXISTS idx_calculator_events_calculator ON public.calculator_events(calculator);
CREATE INDEX IF NOT EXISTS idx_calculator_events_created_at ON public.calculator_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculator_events_session ON public.calculator_events(session_id);
CREATE INDEX IF NOT EXISTS idx_calculator_events_user ON public.calculator_events(user_id);

-- Allow service role full access (used by API)
ALTER TABLE public.calculator_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_events' AND policyname = 'service_all_calculator_events'
  ) THEN
    CREATE POLICY service_all_calculator_events ON public.calculator_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Allow authenticated users to read only their own events (optional client access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_events' AND policyname = 'user_own_calculator_events'
  ) THEN
    CREATE POLICY user_own_calculator_events ON public.calculator_events
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END
$$;
