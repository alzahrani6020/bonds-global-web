-- Bonds Global establishment information form
CREATE TABLE IF NOT EXISTS public.client_establishment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','reviewed','archived')),
  identity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  registration_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  operations_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  management_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_establishment_profiles_user
  ON public.client_establishment_profiles(user_id)
  WHERE status IN ('draft','submitted','reviewed');

CREATE INDEX IF NOT EXISTS idx_client_establishment_profiles_client
  ON public.client_establishment_profiles(client_id);

ALTER TABLE public.client_establishment_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS establishment_profile_select_own ON public.client_establishment_profiles;
CREATE POLICY establishment_profile_select_own
  ON public.client_establishment_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS establishment_profile_insert_own ON public.client_establishment_profiles;
CREATE POLICY establishment_profile_insert_own
  ON public.client_establishment_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS establishment_profile_update_own ON public.client_establishment_profiles;
CREATE POLICY establishment_profile_update_own
  ON public.client_establishment_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','submitted'));

CREATE OR REPLACE FUNCTION public.touch_client_establishment_profile_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_client_establishment_profile ON public.client_establishment_profiles;
CREATE TRIGGER trg_touch_client_establishment_profile
BEFORE UPDATE ON public.client_establishment_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_client_establishment_profile_updated_at();
