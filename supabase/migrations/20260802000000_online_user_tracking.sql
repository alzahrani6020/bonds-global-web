-- ============================================
-- Online Users & Journey Tracking
-- Tracks real-time presence and per-second journey for all visitors
-- ============================================

-- Enhance existing page_views with session, location, and duration
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS duration_seconds int;

CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_country ON public.page_views(country);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at_desc ON public.page_views(created_at DESC);

-- Real-time presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
  session_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  country text,
  country_code text,
  city text,
  region text,
  page text,
  section text,
  url text,
  user_agent text,
  screen text,
  lang text,
  started_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  is_online boolean DEFAULT true
);

COMMENT ON TABLE public.user_presence IS 'Real-time visitor presence for the Online Users dashboard';

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_presence_country ON public.user_presence(country);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);

-- RLS policies
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous presence inserts" ON public.user_presence;
CREATE POLICY "Allow anonymous presence inserts"
  ON public.user_presence FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous presence updates" ON public.user_presence;
CREATE POLICY "Allow anonymous presence updates"
  ON public.user_presence FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read presence" ON public.user_presence;
CREATE POLICY "Admins can read presence"
  ON public.user_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'admin', 'support')
    )
    OR current_setting('app.owner_email', true) IS NOT NULL
  );

-- Allow anonymous inserts into page_views (already allowed by existing policy, ensure new columns are covered)
DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;
CREATE POLICY "Allow anonymous page view inserts"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read page_views" ON public.page_views;
CREATE POLICY "Admins can read page_views"
  ON public.page_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('super_admin', 'admin', 'support')
    )
    OR current_setting('app.owner_email', true) IS NOT NULL
  );
