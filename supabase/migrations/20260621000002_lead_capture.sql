-- Lead Capture System
-- Allows anonymous visitors to submit their data via free tools and creates client records.

-- Add source tracking to advisory_clients
ALTER TABLE public.advisory_clients
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS phone text;

-- Update unique constraint on email to allow NULLs (already handled by partial unique)
-- Ensure normalized emails remain unique only for non-NULL values.
ALTER TABLE public.advisory_clients
DROP CONSTRAINT IF EXISTS uq_advisory_clients_email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_advisory_clients_email
ON public.advisory_clients(email)
WHERE email IS NOT NULL;

-- RPC: capture a lead from public calculators/forms (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.capture_lead(
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_source text DEFAULT 'website',
  p_source_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_normalized_email text;
BEGIN
  v_normalized_email := lower(trim(coalesce(p_email, '')));

  -- Try to update existing record by email
  UPDATE public.advisory_clients
  SET
    name = coalesce(p_name, name),
    phone = coalesce(p_phone, phone),
    company_name = coalesce(p_company_name, company_name),
    sector = coalesce(p_sector, sector),
    country = coalesce(p_country, country),
    source = coalesce(p_source, source),
    source_url = coalesce(p_source_url, source_url),
    status = coalesce(status, 'lead'),
    updated_at = now()
  WHERE email = v_normalized_email
  RETURNING id INTO v_id;

  -- If no existing record, insert a new lead
  IF v_id IS NULL THEN
    INSERT INTO public.advisory_clients (
      name,
      email,
      phone,
      company_name,
      sector,
      country,
      status,
      source,
      source_url
    ) VALUES (
      p_name,
      v_normalized_email,
      p_phone,
      p_company_name,
      p_sector,
      p_country,
      'lead',
      p_source,
      p_source_url
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Allow anonymous/public to call the capture_lead function
GRANT EXECUTE ON FUNCTION public.capture_lead(text, text, text, text, text, text, text, text) TO anon, authenticated;
