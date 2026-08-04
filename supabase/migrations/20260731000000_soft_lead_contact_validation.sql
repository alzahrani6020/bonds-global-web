-- Allow incomplete/incorrect lead and contact submissions
-- by softening NOT NULL constraints and adding validation_status flags.

-- 1) Calculator leads: email no longer required; add validation tracking
ALTER TABLE IF EXISTS public.calculator_leads
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS business_activity text;

ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending';

ALTER TABLE public.calculator_leads
  ADD COLUMN IF NOT EXISTS validation_notes text;

-- 2) Contact messages: name and message no longer required; add validation tracking
ALTER TABLE IF EXISTS public.contact_messages
  ALTER COLUMN name DROP NOT NULL;

ALTER TABLE IF EXISTS public.contact_messages
  ALTER COLUMN message DROP NOT NULL;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending';

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS validation_notes text;

-- 3) Indexes for filtering by quality/status
CREATE INDEX IF NOT EXISTS idx_calculator_leads_validation_status ON public.calculator_leads(validation_status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_validation_status ON public.contact_messages(validation_status);
