-- ============================================
-- Bank Transfer Requests Table
-- طلبات التحويل البنكي المباشر
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_transfer_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  tier text NOT NULL CHECK (tier IN ('pro', 'enterprise')),
  amount_sar integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.bank_transfer_requests IS 'طلبات التحويل البنكي المباشر';

-- Enable RLS
ALTER TABLE public.bank_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit
CREATE POLICY "Anyone can submit bank transfer"
  ON public.bank_transfer_requests FOR INSERT
  WITH CHECK (true);

-- Only service_role can read/update
CREATE POLICY "Service role can manage bank transfers"
  ON public.bank_transfer_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin can read via service role only
CREATE POLICY "Block public reads on bank transfers"
  ON public.bank_transfer_requests FOR SELECT
  USING (false);
