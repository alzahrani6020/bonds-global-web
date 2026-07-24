-- Data retention support for calculator leads.
-- anonymized_at marks leads that have had PII cleared for GDPR compliance.
ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calculator_leads_anonymized_at ON public.calculator_leads(anonymized_at);
