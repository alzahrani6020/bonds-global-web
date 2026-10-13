-- Bonds Global client KYC / EDD workflow
-- Client-entered data is isolated from internal compliance review data.

CREATE TABLE IF NOT EXISTS public.client_kyc_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','additional_information_required','under_review','approved','rejected','closed')),
  form_version text NOT NULL DEFAULT '2026.1',
  client_type text,
  identity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ownership_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  funds_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_disclosures jsonb NOT NULL DEFAULT '{}'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  declarations jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_kyc_cases_active_user
  ON public.client_kyc_cases(user_id)
  WHERE status IN ('draft','submitted','additional_information_required','under_review');

CREATE INDEX IF NOT EXISTS idx_client_kyc_cases_client_id
  ON public.client_kyc_cases(client_id);

CREATE TABLE IF NOT EXISTS public.client_kyc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id uuid NOT NULL UNIQUE REFERENCES public.client_kyc_cases(id) ON DELETE CASCADE,
  screening_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_risk text CHECK (overall_risk IN ('low','medium','high','unacceptable')),
  decision text CHECK (decision IN ('accept','conditional_acceptance','request_edd','suspend','reject')),
  reviewer_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_kyc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_kyc_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_kyc_cases_select_own ON public.client_kyc_cases;
CREATE POLICY client_kyc_cases_select_own ON public.client_kyc_cases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS client_kyc_cases_insert_own ON public.client_kyc_cases;
CREATE POLICY client_kyc_cases_insert_own ON public.client_kyc_cases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS client_kyc_cases_update_own ON public.client_kyc_cases;
CREATE POLICY client_kyc_cases_update_own ON public.client_kyc_cases
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','additional_information_required'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','additional_information_required','submitted'));

-- Internal review is intentionally server-side/service-role only.
REVOKE ALL ON public.client_kyc_reviews FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_client_kyc_case_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_client_kyc_case ON public.client_kyc_cases;
CREATE TRIGGER trg_touch_client_kyc_case
BEFORE UPDATE ON public.client_kyc_cases
FOR EACH ROW EXECUTE FUNCTION public.touch_client_kyc_case_updated_at();

CREATE OR REPLACE FUNCTION public.touch_client_kyc_review_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_client_kyc_review ON public.client_kyc_reviews;
CREATE TRIGGER trg_touch_client_kyc_review
BEFORE UPDATE ON public.client_kyc_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_client_kyc_review_updated_at();
