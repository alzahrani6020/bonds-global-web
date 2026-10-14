-- Generic credit-information consent forms for individuals and businesses.
-- Deliberately does not store or reference any named credit bureau, financing entity, or person.
CREATE TABLE IF NOT EXISTS public.client_credit_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('business','individual')),
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','revoked','archived')),
  subject_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_text_version text NOT NULL DEFAULT '2026-10',
  consented_at timestamptz,
  revoked_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_consents_user
  ON public.client_credit_consents(user_id, subject_type, updated_at DESC);

ALTER TABLE public.client_credit_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_consents_select_own ON public.client_credit_consents;
CREATE POLICY credit_consents_select_own
  ON public.client_credit_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS credit_consents_insert_own ON public.client_credit_consents;
CREATE POLICY credit_consents_insert_own
  ON public.client_credit_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS credit_consents_update_own ON public.client_credit_consents;
CREATE POLICY credit_consents_update_own
  ON public.client_credit_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_credit_consent_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_credit_consent ON public.client_credit_consents;
CREATE TRIGGER trg_touch_credit_consent
BEFORE UPDATE ON public.client_credit_consents
FOR EACH ROW EXECUTE FUNCTION public.touch_credit_consent_updated_at();
