-- ============================================
-- Moyasar Invoices Table
-- Tracks SADAD/Bank Transfer payments
-- ============================================

CREATE TABLE IF NOT EXISTS public.moyasar_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users NOT NULL,
  tier text NOT NULL CHECK (tier IN ('pro', 'enterprise')),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'paid', 'failed', 'expired')),
  url text,
  metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_user_id ON public.moyasar_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_status ON public.moyasar_invoices(status);

-- RLS: users can only see their own invoices
ALTER TABLE public.moyasar_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own moyasar invoices"
  ON public.moyasar_invoices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all moyasar invoices"
  ON public.moyasar_invoices
  FOR ALL
  USING (true)
  WITH CHECK (true);
