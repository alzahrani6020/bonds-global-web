-- Migration: Dashboard final fixes — missing City Intelligence columns + admin seed + performance indexes
-- Created: 2026-06-18

-- ------------------------------------------------------------------
-- 1. Ensure City Intelligence status columns exist (idempotent)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cities'
  ) THEN
    ALTER TABLE public.cities
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    -- Add check constraint only if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_schema = 'public' AND table_name = 'cities' AND constraint_name = 'cities_status_check'
    ) THEN
      ALTER TABLE public.cities
        ADD CONSTRAINT cities_status_check CHECK (status IN ('active','archived'));
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'districts'
  ) THEN
    ALTER TABLE public.districts
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_schema = 'public' AND table_name = 'districts' AND constraint_name = 'districts_status_check'
    ) THEN
      ALTER TABLE public.districts
        ADD CONSTRAINT districts_status_check CHECK (status IN ('active','archived'));
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 2. Seed admin + city admin role for the owner account
-- ------------------------------------------------------------------
INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'iiffund.dev@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

INSERT INTO public.city_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'iiffund.dev@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- ------------------------------------------------------------------
-- 3. Performance indexes for analytics/admin queries (idempotent)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usage_logs') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_usage_logs_calculator ON public.usage_logs(calculator)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='page_views') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='page_sessions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_page_sessions_started_at ON public.page_sessions(started_at DESC)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bank_transfer_requests') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bank_transfer_status ON public.bank_transfer_requests(status)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contact_messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC)';
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 4. Refresh schema cache hints
-- ------------------------------------------------------------------
COMMENT ON TABLE public.cities IS 'Cities covered by City Intelligence (status added/verified)';
COMMENT ON TABLE public.districts IS 'Districts/neighborhoods covered by City Intelligence (status added/verified)';
