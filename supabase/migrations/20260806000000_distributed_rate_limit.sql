-- Migration: Distributed rate-limit bucket store
-- Replaces the per-instance in-memory Map with a Supabase-backed bucket table.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at ON public.rate_limit_buckets(reset_at);

COMMENT ON TABLE public.rate_limit_buckets IS 'Distributed rate-limit counters for API endpoints.';

-- Atomically increment a bucket, reset it if the window has passed, and return whether the request is allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit_bucket(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms BIGINT,
  p_now_ms BIGINT
)
RETURNS TABLE(allowed BOOLEAN, count INTEGER, reset_at BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset BIGINT := ((p_now_ms / p_window_ms) + 1) * p_window_ms;
  v_count INTEGER;
  v_reset_at BIGINT;
BEGIN
  INSERT INTO public.rate_limit_buckets AS r (key, count, reset_at)
  VALUES (p_key, 1, v_reset)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.reset_at <= p_now_ms THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= p_now_ms THEN v_reset ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset_at;

  RETURN QUERY SELECT (v_count <= p_limit), v_count, v_reset_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT) TO anon;
