-- Calculator leads table for email capture from anonymous users
-- Used by exit-intent and sticky CTA to recover users later.

CREATE TABLE IF NOT EXISTS public.calculator_leads (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  calculator VARCHAR(64) NOT NULL,
  country VARCHAR(8),
  lang VARCHAR(8),
  session_id VARCHAR(64),
  source VARCHAR(32) NOT NULL DEFAULT 'exit_intent',
  url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_email ON public.calculator_leads(email);
CREATE INDEX IF NOT EXISTS idx_calculator_leads_calculator ON public.calculator_leads(calculator);
CREATE INDEX IF NOT EXISTS idx_calculator_leads_created_at ON public.calculator_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculator_leads_source ON public.calculator_leads(source);

ALTER TABLE public.calculator_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_leads' AND policyname = 'service_all_calculator_leads'
  ) THEN
    CREATE POLICY service_all_calculator_leads ON public.calculator_leads
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Allow anonymous inserts via API (no read-back for privacy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_leads' AND policyname = 'anon_insert_calculator_leads'
  ) THEN
    CREATE POLICY anon_insert_calculator_leads ON public.calculator_leads
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;
