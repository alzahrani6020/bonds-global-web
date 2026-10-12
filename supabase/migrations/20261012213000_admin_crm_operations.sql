-- Admin CRM operations foundation
-- Organizations, decision makers, pipeline, renewals and customer success.

-- The original advisory_clients constraint predates lead capture. Align it with
-- the statuses already used by capture_lead() without deleting existing data.
ALTER TABLE public.advisory_clients
  DROP CONSTRAINT IF EXISTS advisory_clients_status_check;
ALTER TABLE public.advisory_clients
  ADD CONSTRAINT advisory_clients_status_check
  CHECK (status IN ('lead','active','inactive','archived','prospect','customer'));

CREATE TABLE IF NOT EXISTS public.crm_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  domain text,
  country text,
  city text,
  sector text,
  tax_number text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect','active','inactive','customer','archived')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_organizations_status ON public.crm_organizations(status);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_owner ON public.crm_organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_name ON public.crm_organizations(name);

ALTER TABLE public.advisory_clients
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_decision_maker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relationship_role text,
  ADD COLUMN IF NOT EXISTS account_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_advisory_clients_organization ON public.advisory_clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisory_clients_account_owner ON public.advisory_clients(account_owner);

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead','qualified','proposal','negotiation','won','lost')),
  value_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  probability integer NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date date,
  source text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action text,
  next_action_at timestamptz,
  lost_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON public.crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_org ON public.crm_opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_owner ON public.crm_opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_close ON public.crm_opportunities(expected_close_date);

CREATE TABLE IF NOT EXISTS public.crm_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  subscription_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  renewal_date date NOT NULL,
  value_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','contacted','negotiating','renewed','churned','cancelled')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_renewals_date ON public.crm_renewals(renewal_date);
CREATE INDEX IF NOT EXISTS idx_crm_renewals_status ON public.crm_renewals(status);
CREATE INDEX IF NOT EXISTS idx_crm_renewals_owner ON public.crm_renewals(owner_user_id);

CREATE TABLE IF NOT EXISTS public.crm_customer_success (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  health_score integer NOT NULL DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  lifecycle_stage text NOT NULL DEFAULT 'onboarding'
    CHECK (lifecycle_stage IN ('onboarding','activated','adopting','healthy','at_risk','churned')),
  next_review_at timestamptz,
  success_plan jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_success_risk ON public.crm_customer_success(risk_level);
CREATE INDEX IF NOT EXISTS idx_crm_customer_success_owner ON public.crm_customer_success(owner_user_id);

ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_success ENABLE ROW LEVEL SECURITY;

-- All CRM writes are server-mediated through the admin API/service role.
REVOKE ALL ON public.crm_organizations FROM anon, authenticated;
REVOKE ALL ON public.crm_opportunities FROM anon, authenticated;
REVOKE ALL ON public.crm_renewals FROM anon, authenticated;
REVOKE ALL ON public.crm_customer_success FROM anon, authenticated;
