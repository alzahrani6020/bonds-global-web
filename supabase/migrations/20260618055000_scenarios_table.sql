-- Migration: Create scenarios table referenced by admin RLS policies
-- The scenarios table stores saved calculator scenarios for users.

CREATE TABLE IF NOT EXISTS public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  country text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scenarios IS 'Saved calculator scenarios per user';

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own scenarios" ON public.scenarios;
CREATE POLICY "Users can CRUD own scenarios"
  ON public.scenarios FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public scenarios are readable" ON public.scenarios;
CREATE POLICY "Public scenarios are readable"
  ON public.scenarios FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON public.scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_is_public ON public.scenarios(is_public);
