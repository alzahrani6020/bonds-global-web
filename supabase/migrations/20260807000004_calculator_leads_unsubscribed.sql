-- Add unsubscribed_at column to calculator_leads for one-click unsubscribe tracking

ALTER TABLE public.calculator_leads
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calculator_leads_unsubscribed_at ON public.calculator_leads(unsubscribed_at);
