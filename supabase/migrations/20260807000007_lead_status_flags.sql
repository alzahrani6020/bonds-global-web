-- Add status flags to calculator_leads for conversion, bounce, and complaint tracking

ALTER TABLE public.calculator_leads
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calculator_leads_converted_at ON public.calculator_leads(converted_at);
CREATE INDEX IF NOT EXISTS idx_calculator_leads_bounced_at ON public.calculator_leads(bounced_at);
CREATE INDEX IF NOT EXISTS idx_calculator_leads_complained_at ON public.calculator_leads(complained_at);
