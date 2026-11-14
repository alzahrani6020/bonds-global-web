-- Revert only the unused service-request atomic/context additions.
-- Keep all existing service requests, values, CRM records, and migration history.
-- Production preflight (2026-11-14): 19 requests; all three link columns NULL.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.service_requests
    WHERE project_id IS NOT NULL OR deal_id IS NOT NULL OR opportunity_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SERVICE_CONTEXT_LINKS_NOT_EMPTY: rollback stopped without changes';
  END IF;
END
$guard$;

-- RESTRICT (the default) prevents silently removing unrelated dependent objects.
DROP FUNCTION IF EXISTS public.create_service_request_atomic(jsonb,jsonb,integer) RESTRICT;
ALTER TABLE public.service_requests
  DROP COLUMN IF EXISTS project_id RESTRICT,
  DROP COLUMN IF EXISTS deal_id RESTRICT,
  DROP COLUMN IF EXISTS opportunity_id RESTRICT;
