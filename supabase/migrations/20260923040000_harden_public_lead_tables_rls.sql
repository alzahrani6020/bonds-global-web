-- Harden lead intake tables.
-- These tables are written only through server-side API routes using service_role.
-- Browser roles must have no direct access.

-- ---------------------------------------------------------------------------
-- bank_partner_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_partner_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage bank partner requests"
  ON public.bank_partner_requests;

DROP POLICY IF EXISTS "bank_partner_requests_anon_insert"
  ON public.bank_partner_requests;

DROP POLICY IF EXISTS "bank_partner_requests_public_insert"
  ON public.bank_partner_requests;

REVOKE ALL ON TABLE public.bank_partner_requests FROM anon;
REVOKE ALL ON TABLE public.bank_partner_requests FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.bank_partner_requests
  TO service_role;

-- ---------------------------------------------------------------------------
-- funding_readiness_leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.funding_readiness_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_readiness_leads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage funding readiness leads"
  ON public.funding_readiness_leads;

DROP POLICY IF EXISTS "funding_readiness_leads_anon_insert"
  ON public.funding_readiness_leads;

DROP POLICY IF EXISTS "funding_readiness_leads_public_insert"
  ON public.funding_readiness_leads;

REVOKE ALL ON TABLE public.funding_readiness_leads FROM anon;
REVOKE ALL ON TABLE public.funding_readiness_leads FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.funding_readiness_leads
  TO service_role;
