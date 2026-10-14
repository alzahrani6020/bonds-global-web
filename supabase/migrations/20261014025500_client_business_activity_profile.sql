-- Client business activity information profile.
CREATE TABLE IF NOT EXISTS public.client_business_activity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','reviewed','archived')),
  classification_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  operating_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  market_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_growth_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_activity_user
  ON public.client_business_activity_profiles(user_id, updated_at DESC);

ALTER TABLE public.client_business_activity_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_activity_select_own ON public.client_business_activity_profiles;
CREATE POLICY business_activity_select_own
  ON public.client_business_activity_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS business_activity_insert_own ON public.client_business_activity_profiles;
CREATE POLICY business_activity_insert_own
  ON public.client_business_activity_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS business_activity_update_own ON public.client_business_activity_profiles;
CREATE POLICY business_activity_update_own
  ON public.client_business_activity_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_business_activity_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_business_activity ON public.client_business_activity_profiles;
CREATE TRIGGER trg_touch_business_activity
BEFORE UPDATE ON public.client_business_activity_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_business_activity_updated_at();
