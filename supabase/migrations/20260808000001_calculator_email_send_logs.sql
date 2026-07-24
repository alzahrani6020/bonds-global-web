-- Track failed calculator lead email sends for retry and debugging.
CREATE TABLE IF NOT EXISTS public.calculator_email_send_logs (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES public.calculator_leads(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  step INTEGER NOT NULL,
  attempts INTEGER DEFAULT 1 NOT NULL,
  last_error TEXT,
  failed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(lead_id, step)
);

CREATE INDEX IF NOT EXISTS idx_calc_email_send_logs_lead ON public.calculator_email_send_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_calc_email_send_logs_email ON public.calculator_email_send_logs(email);
CREATE INDEX IF NOT EXISTS idx_calc_email_send_logs_step ON public.calculator_email_send_logs(step);
CREATE INDEX IF NOT EXISTS idx_calc_email_send_logs_failed ON public.calculator_email_send_logs(failed_at);

ALTER TABLE public.calculator_email_send_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calculator_email_send_logs' AND policyname = 'service_all_calc_email_send_logs'
  ) THEN
    CREATE POLICY service_all_calc_email_send_logs ON public.calculator_email_send_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;
