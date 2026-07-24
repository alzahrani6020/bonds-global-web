-- Add email_hash to calculator_leads for privacy-safe analytics

ALTER TABLE public.calculator_leads
ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_calculator_leads_email_hash ON public.calculator_leads(email_hash);

-- Backfill existing rows
UPDATE public.calculator_leads
SET email_hash = encode(sha256(lower(email)::bytea), 'hex')
WHERE email_hash IS NULL AND email IS NOT NULL;
