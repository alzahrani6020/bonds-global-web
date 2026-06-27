-- Migration: Create user_roles table for generic admin/editor checks
-- Referenced by economic_life_database, depreciation_factors, market_intelligence,
-- condition_assessment, and asset_condition_assessments migrations.

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role),
  CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'editor', 'viewer'))
);

COMMENT ON TABLE public.user_roles IS 'Generic user roles for admin/editor access checks';

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;
CREATE POLICY "Service role can manage user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP INDEX IF EXISTS idx_user_roles_user_id;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
DROP INDEX IF EXISTS idx_user_roles_role;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
