-- ============================================
-- Page Views & Session Tracking v2
-- Compatible with api/track.js and api/admin.js
-- Safe: does NOT drop existing tables (avoids data loss)
-- ============================================

-- Page views (lightweight tracking)
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  page text,
  section text,
  url text,
  referrer text,
  lang text,
  screen text,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.page_views IS 'Page view tracking by section and page';

-- Page sessions (duration tracking)
CREATE TABLE IF NOT EXISTS public.page_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  page text,
  section text,
  duration_seconds int,
  url text,
  referrer text,
  lang text,
  screen text,
  source text DEFAULT 'web',
  started_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.page_sessions IS 'Session duration tracking per page';

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking beacon from any visitor)
DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;
CREATE POLICY "Allow anonymous page view inserts"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous session inserts" ON public.page_sessions;
CREATE POLICY "Allow anonymous session inserts"
  ON public.page_sessions FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON public.page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_section ON public.page_views(section);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON public.page_views(user_id);

CREATE INDEX IF NOT EXISTS idx_page_sessions_started ON public.page_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_page_sessions_page ON public.page_sessions(page);
CREATE INDEX IF NOT EXISTS idx_page_sessions_user_id ON public.page_sessions(user_id);
