-- Bonds V3 — Canonical activity taxonomy hardening

-- Make the public catalog obey underlying RLS policies instead of owner privileges.
ALTER VIEW public.canonical_activity_catalog SET (security_invoker = true);

-- Trigger functions do not need direct RPC exposure.
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM anon;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM authenticated;

-- Cover the remaining FK used by lifecycle/update operations.
CREATE INDEX IF NOT EXISTS idx_canonical_activity_sub_sector_source_legacy
  ON public.canonical_activity_sub_sector_map(source_legacy_activity_id);