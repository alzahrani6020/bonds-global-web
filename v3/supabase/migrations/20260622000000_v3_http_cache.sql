-- Bonds V3 — HTTP cache table for external API responses
-- Used by the unified HttpClient to avoid repeated calls to rate-limited sources.

CREATE TABLE IF NOT EXISTS public.http_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_http_cache_expires
  ON public.http_cache(expires_at);

ALTER TABLE public.http_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage http cache"
  ON public.http_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
