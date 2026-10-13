-- Harden receivables aging integrity: validate rows and calculate buckets server-side.
CREATE OR REPLACE FUNCTION public.normalize_receivables_aging_report()
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
    IF nullif(trim(coalesce(item->>'customer','')), '') IS NULL THEN
      RAISE EXCEPTION 'customer is required for every receivable row';
    END IF;
    IF nullif(trim(coalesce(item->>'invoice_no','')), '') IS NULL THEN
      RAISE EXCEPTION 'invoice_no is required for every receivable row';
    END IF;
    IF nullif(item->>'invoice_date','') IS NULL THEN
      RAISE EXCEPTION 'invoice_date is required for every receivable row';
    END IF;
    IF NEW.aging_basis = 'due_date' AND nullif(item->>'due_date','') IS NULL THEN
      RAISE EXCEPTION 'due_date is required when aging basis is due_date';
    END IF;

    invoice_amount := coalesce((item->>'invoice_amount')::numeric,0);
    paid_amount := coalesce((item->>'paid_amount')::numeric,0);

    IF invoice_amount < 0 OR paid_amount < 0 THEN
      RAISE EXCEPTION 'invoice and paid amounts must be non-negative';
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
      'customer', trim(item->>'customer'),
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

DROP TRIGGER IF EXISTS trg_normalize_receivables_aging ON public.client_receivables_aging_reports;
CREATE TRIGGER trg_normalize_receivables_aging
BEFORE INSERT OR UPDATE OF rows, report_date, aging_basis
ON public.client_receivables_aging_reports
FOR EACH ROW EXECUTE FUNCTION public.normalize_receivables_aging_report();
