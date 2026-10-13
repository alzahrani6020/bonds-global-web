-- Client 12-month cash flow statements with server-side normalization.
CREATE TABLE IF NOT EXISTS public.client_cash_flow_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','reviewed','archived')),
  start_month date NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  opening_balance numeric NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  months jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_user
  ON public.client_cash_flow_reports(user_id, created_at DESC);

ALTER TABLE public.client_cash_flow_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_flow_select_own ON public.client_cash_flow_reports;
CREATE POLICY cash_flow_select_own
  ON public.client_cash_flow_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS cash_flow_insert_own ON public.client_cash_flow_reports;
CREATE POLICY cash_flow_insert_own
  ON public.client_cash_flow_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cash_flow_update_own ON public.client_cash_flow_reports;
CREATE POLICY cash_flow_update_own
  ON public.client_cash_flow_reports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_cash_flow_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_cash_flow ON public.client_cash_flow_reports;
CREATE TRIGGER trg_touch_cash_flow
BEFORE UPDATE ON public.client_cash_flow_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_cash_flow_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_cash_flow_report()
RETURNS trigger AS $$
DECLARE
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  idx integer := 0;
  month_date date;
  opening numeric := NEW.opening_balance;
  inflows numeric;
  outflows numeric;
  net_flow numeric;
  closing numeric;
  total_inflows numeric := 0;
  total_outflows numeric := 0;
  min_balance numeric := NULL;
  max_balance numeric := NULL;
  negative_months integer := 0;
  row_obj jsonb;
  sales_receipts numeric;
  receivable_collections numeric;
  financing_inflows numeric;
  owner_injections numeric;
  other_inflows numeric;
  supplier_payments numeric;
  payroll numeric;
  rent numeric;
  operating_expenses numeric;
  debt_service numeric;
  taxes_zakat_vat numeric;
  capex numeric;
  dividends_drawings numeric;
  other_outflows numeric;
BEGIN
  IF NEW.start_month IS NULL THEN
    RAISE EXCEPTION 'start_month is required';
  END IF;

  IF NEW.months IS NULL OR jsonb_typeof(NEW.months) <> 'array' OR jsonb_array_length(NEW.months) <> 12 THEN
    RAISE EXCEPTION 'months must contain exactly 12 rows';
  END IF;

  IF NEW.opening_balance < 0 THEN
    RAISE EXCEPTION 'opening balance cannot be negative';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.months)
  LOOP
    month_date := (date_trunc('month', NEW.start_month::timestamp) + make_interval(months => idx))::date;

    sales_receipts := coalesce((item->>'sales_receipts')::numeric,0);
    receivable_collections := coalesce((item->>'receivable_collections')::numeric,0);
    financing_inflows := coalesce((item->>'financing_inflows')::numeric,0);
    owner_injections := coalesce((item->>'owner_injections')::numeric,0);
    other_inflows := coalesce((item->>'other_inflows')::numeric,0);

    supplier_payments := coalesce((item->>'supplier_payments')::numeric,0);
    payroll := coalesce((item->>'payroll')::numeric,0);
    rent := coalesce((item->>'rent')::numeric,0);
    operating_expenses := coalesce((item->>'operating_expenses')::numeric,0);
    debt_service := coalesce((item->>'debt_service')::numeric,0);
    taxes_zakat_vat := coalesce((item->>'taxes_zakat_vat')::numeric,0);
    capex := coalesce((item->>'capex')::numeric,0);
    dividends_drawings := coalesce((item->>'dividends_drawings')::numeric,0);
    other_outflows := coalesce((item->>'other_outflows')::numeric,0);

    IF LEAST(
      sales_receipts, receivable_collections, financing_inflows, owner_injections, other_inflows,
      supplier_payments, payroll, rent, operating_expenses, debt_service, taxes_zakat_vat,
      capex, dividends_drawings, other_outflows
    ) < 0 THEN
      RAISE EXCEPTION 'cash flow line items cannot be negative';
    END IF;

    inflows := sales_receipts + receivable_collections + financing_inflows + owner_injections + other_inflows;
    outflows := supplier_payments + payroll + rent + operating_expenses + debt_service +
                taxes_zakat_vat + capex + dividends_drawings + other_outflows;
    net_flow := inflows - outflows;
    closing := opening + net_flow;

    row_obj := jsonb_build_object(
      'month', to_char(month_date,'YYYY-MM'),
      'opening_balance', opening,
      'sales_receipts', sales_receipts,
      'receivable_collections', receivable_collections,
      'financing_inflows', financing_inflows,
      'owner_injections', owner_injections,
      'other_inflows', other_inflows,
      'total_inflows', inflows,
      'supplier_payments', supplier_payments,
      'payroll', payroll,
      'rent', rent,
      'operating_expenses', operating_expenses,
      'debt_service', debt_service,
      'taxes_zakat_vat', taxes_zakat_vat,
      'capex', capex,
      'dividends_drawings', dividends_drawings,
      'other_outflows', other_outflows,
      'total_outflows', outflows,
      'net_cash_flow', net_flow,
      'closing_balance', closing
    );

    normalized := normalized || jsonb_build_array(row_obj);
    total_inflows := total_inflows + inflows;
    total_outflows := total_outflows + outflows;
    min_balance := CASE WHEN min_balance IS NULL THEN closing ELSE LEAST(min_balance, closing) END;
    max_balance := CASE WHEN max_balance IS NULL THEN closing ELSE GREATEST(max_balance, closing) END;
    IF closing < 0 THEN negative_months := negative_months + 1; END IF;

    opening := closing;
    idx := idx + 1;
  END LOOP;

  NEW.months := normalized;
  NEW.summary := jsonb_build_object(
    'total_inflows', total_inflows,
    'total_outflows', total_outflows,
    'net_cash_flow', total_inflows - total_outflows,
    'closing_balance', opening,
    'minimum_balance', coalesce(min_balance, NEW.opening_balance),
    'maximum_balance', coalesce(max_balance, NEW.opening_balance),
    'negative_months', negative_months,
    'funding_gap', GREATEST(0, -coalesce(min_balance,0))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_cash_flow ON public.client_cash_flow_reports;
CREATE TRIGGER trg_normalize_cash_flow
BEFORE INSERT OR UPDATE OF months, start_month, opening_balance
ON public.client_cash_flow_reports
FOR EACH ROW EXECUTE FUNCTION public.normalize_cash_flow_report();
