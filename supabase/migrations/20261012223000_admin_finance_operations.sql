-- Admin Finance Operations
-- Refunds, reconciliation, collections, contracts and revenue exceptions.

CREATE TABLE IF NOT EXISTS public.finance_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.moyasar_invoices(id) ON DELETE SET NULL,
  external_reference text,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','processing','completed','rejected','failed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_refunds_status ON public.finance_refunds(status);
CREATE INDEX IF NOT EXISTS idx_finance_refunds_user ON public.finance_refunds(user_id);

CREATE TABLE IF NOT EXISTS public.finance_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('invoice','bank_transfer','subscription','manual')),
  source_id text NOT NULL,
  expected_amount numeric(15,2),
  actual_amount numeric(15,2),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'unmatched'
    CHECK (status IN ('unmatched','matched','variance','ignored','resolved')),
  variance_amount numeric(15,2) GENERATED ALWAYS AS (coalesce(actual_amount,0) - coalesce(expected_amount,0)) STORED,
  notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_status ON public.finance_reconciliation_items(status);

CREATE TABLE IF NOT EXISTS public.finance_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  amount_due numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','contacted','promise_to_pay','paid','written_off','disputed')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_collections_status ON public.finance_collections(status);
CREATE INDEX IF NOT EXISTS idx_finance_collections_due ON public.finance_collections(due_date);

CREATE TABLE IF NOT EXISTS public.finance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  advisory_client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  contract_number text,
  value_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','active','expired','terminated','renewed')),
  start_date date,
  end_date date,
  renewal_notice_days integer NOT NULL DEFAULT 30 CHECK (renewal_notice_days BETWEEN 0 AND 365),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  document_path text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_contracts_status ON public.finance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_finance_contracts_end_date ON public.finance_contracts(end_date);

CREATE TABLE IF NOT EXISTS public.finance_revenue_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount_impact numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','ignored')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_revenue_exceptions_status ON public.finance_revenue_exceptions(status);
CREATE INDEX IF NOT EXISTS idx_finance_revenue_exceptions_severity ON public.finance_revenue_exceptions(severity);

ALTER TABLE public.finance_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_revenue_exceptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.finance_refunds FROM anon, authenticated;
REVOKE ALL ON public.finance_reconciliation_items FROM anon, authenticated;
REVOKE ALL ON public.finance_collections FROM anon, authenticated;
REVOKE ALL ON public.finance_contracts FROM anon, authenticated;
REVOKE ALL ON public.finance_revenue_exceptions FROM anon, authenticated;
