-- Leads captured from the Free Funding Readiness Score funnel
CREATE TABLE IF NOT EXISTS public.funding_readiness_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  city text,
  sector text,
  investment_range text,
  revenue_range text,
  experience_level text,
  collateral text,
  score integer NOT NULL,
  verdict text NOT NULL,
  summary jsonb DEFAULT '{}',
  source text DEFAULT 'funding-readiness',
  utm_campaign text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_readiness_leads_created_at ON public.funding_readiness_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_readiness_leads_email ON public.funding_readiness_leads(email);

ALTER TABLE public.funding_readiness_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage funding readiness leads"
  ON public.funding_readiness_leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
