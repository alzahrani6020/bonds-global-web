-- Calculator lead retargeting email sequences
-- Tracks which follow-up emails have been sent to captured calculator leads.

CREATE TABLE IF NOT EXISTS public.calculator_email_sequences (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES public.calculator_leads(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  calculator VARCHAR(64) NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(lead_id, step)
);

CREATE INDEX IF NOT EXISTS idx_calc_email_seq_lead ON public.calculator_email_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_calc_email_seq_email ON public.calculator_email_sequences(email);
CREATE INDEX IF NOT EXISTS idx_calc_email_seq_step ON public.calculator_email_sequences(step);
CREATE INDEX IF NOT EXISTS idx_calc_email_seq_sent ON public.calculator_email_sequences(sent_at);

-- Allow service role full access
ALTER TABLE public.calculator_email_sequences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_email_sequences' AND policyname = 'service_all_calc_email_seq'
  ) THEN
    CREATE POLICY service_all_calc_email_seq ON public.calculator_email_sequences
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;
