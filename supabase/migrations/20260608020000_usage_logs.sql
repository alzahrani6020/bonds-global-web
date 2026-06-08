-- ============================================
-- Usage Analytics Logs
-- Tracks calculator usage for business insights
-- ============================================

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  calculator text NOT NULL,
  country text,
  inputs jsonb,
  results jsonb,
  scenario_type text,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.usage_logs IS 'Calculator usage analytics';

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Service role can read all; anon can insert (for tracking)
CREATE POLICY "Service role can read usage logs"
  ON public.usage_logs FOR SELECT
  USING (false);

CREATE POLICY "Anyone can log usage"
  ON public.usage_logs FOR INSERT
  WITH CHECK (true);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_calculator ON public.usage_logs(calculator);
CREATE INDEX IF NOT EXISTS idx_usage_logs_country ON public.usage_logs(country);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
