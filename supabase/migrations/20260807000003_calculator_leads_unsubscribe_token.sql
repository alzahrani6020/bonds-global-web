-- Add unsubscribe token to calculator_leads for one-click unsubscribe

ALTER TABLE public.calculator_leads
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_unsubscribe_token ON public.calculator_leads(unsubscribe_token);

-- Backfill existing rows with random tokens
UPDATE public.calculator_leads
SET unsubscribe_token = encode(sha256(random()::text::bytea), 'hex')
WHERE unsubscribe_token IS NULL;
