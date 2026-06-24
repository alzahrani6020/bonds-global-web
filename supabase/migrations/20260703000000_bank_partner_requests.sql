-- B2B bank/fintech partner inquiries
CREATE TABLE IF NOT EXISTS public.bank_partner_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  country text,
  organization_type text CHECK (organization_type IN ('bank', 'fintech', 'investment_firm', 'government', 'other')),
  use_case text,
  estimated_volume text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_scheduled', 'pilot', 'closed', 'declined')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_partner_requests_created_at ON public.bank_partner_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_partner_requests_status ON public.bank_partner_requests(status);

ALTER TABLE public.bank_partner_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage bank partner requests"
  ON public.bank_partner_requests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
