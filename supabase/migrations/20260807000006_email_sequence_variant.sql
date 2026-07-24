-- Add variant column to calculator_email_sequences for A/B testing

ALTER TABLE public.calculator_email_sequences
ADD COLUMN IF NOT EXISTS variant VARCHAR(8) DEFAULT 'A';

CREATE INDEX IF NOT EXISTS idx_calc_email_seq_variant ON public.calculator_email_sequences(variant);

-- Backfill existing rows
UPDATE public.calculator_email_sequences
SET variant = 'A'
WHERE variant IS NULL;
