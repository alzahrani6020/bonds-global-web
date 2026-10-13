-- Client receivables aging reports
CREATE TABLE IF NOT EXISTS public.client_receivables_aging_reports (
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

CREATE INDEX IF NOT EXISTS idx_receivables_aging_user
  ON public.client_receivables_aging_reports(user_id, created_at DESC);

ALTER TABLE public.client_receivables_aging_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receivables_aging_select_own ON public.client_receivables_aging_reports;
CREATE POLICY receivables_aging_select_own
  ON public.client_receivables_aging_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS receivables_aging_insert_own ON public.client_receivables_aging_reports;
CREATE POLICY receivables_aging_insert_own
  ON public.client_receivables_aging_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS receivables_aging_update_own ON public.client_receivables_aging_reports;
CREATE POLICY receivables_aging_update_own
  ON public.client_receivables_aging_reports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_receivables_aging_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_receivables_aging ON public.client_receivables_aging_reports;
CREATE TRIGGER trg_touch_receivables_aging
BEFORE UPDATE ON public.client_receivables_aging_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_receivables_aging_updated_at();
