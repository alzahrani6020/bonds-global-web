-- Add role column to profiles for portfolio/enterprise role-based access.
-- Idempotent; safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN role text NOT NULL DEFAULT 'owner';

    COMMENT ON COLUMN public.profiles.role IS
      'Project-level role: viewer, advisor, admin, or owner.';
  END IF;
END $$;
