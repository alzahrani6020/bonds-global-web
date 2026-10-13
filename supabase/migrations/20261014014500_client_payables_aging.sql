-- Client accounts payable aging reports with server-side validation and normalization.
CREATE TABLE IF NOT EXISTS public.client_payables_aging_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','reviewed','archived')),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  aging_basis text NOT NULL DEFAULT 'due_date'
    CHECK (aging_basis IN ('due_date','invoice_date')),
  currency text NOT NULL DEFAULT 'SAR',
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payables_aging_user
  ON public.client_payables_aging_reports(user_id, created_at DESC);

ALTER TABLE public.client_payables_aging_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payables_aging_select_own ON public.client_payables_aging_reports;
CREATE POLICY payables_aging_select_own
  ON public.client_payables_aging_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS payables_aging_insert_own ON public.client_payables_aging_reports;
CREATE POLICY payables_aging_insert_own
  ON public.client_payables_aging_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS payables_aging_update_own ON public.client_payables_aging_reports;
CREATE POLICY payables_aging_update_own
  ON public.client_payables_aging_reports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_payables_aging_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_payables_aging ON public.client_payables_aging_reports;
CREATE TRIGGER trg_touch_payables_aging
BEFORE UPDATE ON public.client_payables_aging_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_payables_aging_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_payables_aging_report()
RETURNS trigger AS $$
DECLARE
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  invoice_amount numeric;
  paid_amount numeric;
  balance numeric;
  base_date date;
  age_days integer;
  current_amt numeric := 0;
  b30_amt numeric := 0;
  b60_amt numeric := 0;
  b90_amt numeric := 0;
  b120_amt numeric := 0;
  over120_amt numeric := 0;
  total_amt numeric := 0;
  row_obj jsonb;
BEGIN
  IF NEW.rows IS NULL OR jsonb_typeof(NEW.rows) <> 'array' THEN
    RAISE EXCEPTION 'rows must be a JSON array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.rows)
  LOOP
    IF nullif(trim(coalesce(item->>'supplier','')), '') IS NULL THEN
      RAISE EXCEPTION 'supplier is required for every payable row';
    END IF;
    IF nullif(trim(coalesce(item->>'invoice_no','')), '') IS NULL THEN
      RAISE EXCEPTION 'invoice_no is required for every payable row';
    END IF;
    IF nullif(item->>'invoice_date','') IS NULL THEN
      RAISE EXCEPTION 'invoice_date is required for every payable row';
    END IF;
    IF NEW.aging_basis = 'due_date' AND nullif(item->>'due_date','') IS NULL THEN
      RAISE EXCEPTION 'due_date is required when aging basis is due_date';
    END IF;

    invoice_amount := coalesce((item->>'invoice_amount')::numeric,0);
    paid_amount := coalesce((item->>'paid_amount')::numeric,0);

    IF invoice_amount <= 0 OR paid_amount < 0 THEN
      RAISE EXCEPTION 'invalid payable amounts';
    END IF;
    IF paid_amount > invoice_amount THEN
      RAISE EXCEPTION 'paid amount cannot exceed invoice amount';
    END IF;

    balance := invoice_amount - paid_amount;
    base_date := CASE
      WHEN NEW.aging_basis = 'invoice_date' THEN (item->>'invoice_date')::date
      ELSE (item->>'due_date')::date
    END;
    age_days := GREATEST(0, NEW.report_date - base_date);

    row_obj := jsonb_build_object(
      'supplier', trim(item->>'supplier'),
      'invoice_no', trim(item->>'invoice_no'),
      'invoice_date', item->>'invoice_date',
      'due_date', item->>'due_date',
      'invoice_amount', invoice_amount,
      'paid_amount', paid_amount,
      'balance', balance,
      'days_overdue', age_days,
      'current', CASE WHEN NEW.report_date <= base_date THEN balance ELSE 0 END,
      'b30', CASE WHEN NEW.report_date > base_date AND (NEW.report_date - base_date) BETWEEN 1 AND 30 THEN balance ELSE 0 END,
      'b60', CASE WHEN (NEW.report_date - base_date) BETWEEN 31 AND 60 THEN balance ELSE 0 END,
      'b90', CASE WHEN (NEW.report_date - base_date) BETWEEN 61 AND 90 THEN balance ELSE 0 END,
      'b120', CASE WHEN (NEW.report_date - base_date) BETWEEN 91 AND 120 THEN balance ELSE 0 END,
      'over120', CASE WHEN (NEW.report_date - base_date) > 120 THEN balance ELSE 0 END
    );

    normalized := normalized || jsonb_build_array(row_obj);
    total_amt := total_amt + balance;
    current_amt := current_amt + CASE WHEN NEW.report_date <= base_date THEN balance ELSE 0 END;
    b30_amt := b30_amt + CASE WHEN NEW.report_date > base_date AND (NEW.report_date - base_date) BETWEEN 1 AND 30 THEN balance ELSE 0 END;
    b60_amt := b60_amt + CASE WHEN (NEW.report_date - base_date) BETWEEN 31 AND 60 THEN balance ELSE 0 END;
    b90_amt := b90_amt + CASE WHEN (NEW.report_date - base_date) BETWEEN 61 AND 90 THEN balance ELSE 0 END;
    b120_amt := b120_amt + CASE WHEN (NEW.report_date - base_date) BETWEEN 91 AND 120 THEN balance ELSE 0 END;
    over120_amt := over120_amt + CASE WHEN (NEW.report_date - base_date) > 120 THEN balance ELSE 0 END;
  END LOOP;

  NEW.rows := normalized;
  NEW.summary := jsonb_build_object(
    'total', total_amt,
    'current', current_amt,
    'b30', b30_amt,
    'b60', b60_amt,
    'b90', b90_amt,
    'b120', b120_amt,
    'over120', over120_amt
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_payables_aging ON public.client_payables_aging_reports;
CREATE TRIGGER trg_normalize_payables_aging
BEFORE INSERT OR UPDATE OF rows, report_date, aging_basis
ON public.client_payables_aging_reports
FOR EACH ROW EXECUTE FUNCTION public.normalize_payables_aging_report();
