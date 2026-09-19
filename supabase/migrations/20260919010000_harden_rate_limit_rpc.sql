-- Security hardening for distributed rate limiting.
-- Browser clients do not need direct access to the backing table or RPC.
-- Server-side API calls use service_role.

-- Remove historical broad table policies that allowed anon/authenticated
-- direct access to rate_limit_buckets.
DROP POLICY IF EXISTS "rate_limit_buckets_anon_write"
ON public.rate_limit_buckets;

DROP POLICY IF EXISTS "rate_limit_buckets_authenticated_write"
ON public.rate_limit_buckets;

-- Remove direct table privileges from browser roles.
REVOKE SELECT, INSERT, UPDATE, DELETE
ON public.rate_limit_buckets
FROM anon;

REVOKE SELECT, INSERT, UPDATE, DELETE
ON public.rate_limit_buckets
FROM authenticated;

-- Restrict direct RPC execution to service_role.
REVOKE EXECUTE ON FUNCTION
  public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT)
FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION
  public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT)
FROM anon;

REVOKE EXECUTE ON FUNCTION
  public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
  public.check_rate_limit_bucket(TEXT, INTEGER, BIGINT, BIGINT)
TO service_role;
