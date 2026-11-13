-- Service requests: a single atomic database write and verified workspace references.
-- Additive migration. No destructive changes to existing service requests.
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.bonds_projects(id),
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.bonds_deals(id),
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.bonds_investment_opportunities(id);

CREATE OR REPLACE FUNCTION public.create_service_request_atomic(
  p_request jsonb,
  p_values jsonb DEFAULT '{}'::jsonb,
  p_form_version integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  saved public.service_requests%ROWTYPE;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_SERVICE_REQUEST';
  END IF;
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_SERVICE_REQUEST_VALUES';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_values)) > 200 OR length(p_values::text) > 131072 THEN
    RAISE EXCEPTION 'SERVICE_REQUEST_VALUES_TOO_LARGE';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_values) AS fields WHERE length(fields.key) > 128 OR fields.key = '') THEN
    RAISE EXCEPTION 'INVALID_SERVICE_REQUEST_FIELD_KEY';
  END IF;

  INSERT INTO public.service_requests (
    user_id, client_id, service_id, package_id, goal_code,
    country_code, region_code, region_name, locality_code, locality_name,
    geo_place_id, geo_snapshot, sector_code, canonical_activity_id,
    status, submitted_at, metadata, project_id, deal_id, opportunity_id
  ) VALUES (
    (p_request->>'user_id')::uuid, (p_request->>'client_id')::uuid,
    (p_request->>'service_id')::uuid, (p_request->>'package_id')::uuid,
    p_request->>'goal_code',
    p_request->>'country_code', p_request->>'region_code',
    p_request->>'region_name', p_request->>'locality_code',
    p_request->>'locality_name', (p_request->>'geo_place_id')::uuid,
    coalesce(p_request->'geo_snapshot', '{}'::jsonb),
    p_request->>'sector_code', (p_request->>'canonical_activity_id')::uuid,
    'submitted', now(), coalesce(p_request->'metadata', '{}'::jsonb),
    (p_request->>'project_id')::uuid, (p_request->>'deal_id')::uuid,
    (p_request->>'opportunity_id')::uuid
  ) RETURNING * INTO saved;

  INSERT INTO public.service_request_values (service_request_id, field_key, value, form_version)
  SELECT saved.id, fields.key, fields.value, p_form_version
  FROM jsonb_each(p_values) AS fields;

  RETURN jsonb_build_object(
    'id', saved.id,
    'request_reference', saved.request_reference,
    'status', saved.status,
    'geo_place_id', saved.geo_place_id,
    'geo_snapshot', saved.geo_snapshot,
    'created_at', saved.created_at,
    'project_id', saved.project_id,
    'deal_id', saved.deal_id,
    'opportunity_id', saved.opportunity_id
  );
END;
$function$;

-- RPC is server-only. The API uses its service-role credential and
-- validates user ownership before calling this invoker-security function.
REVOKE ALL ON FUNCTION public.create_service_request_atomic(jsonb,jsonb,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_request_atomic(jsonb,jsonb,integer)
  TO service_role;
