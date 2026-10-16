-- Reconciled from production migration ledger 20261016230728 (harden_capture_lead_public_intake).
CREATE OR REPLACE FUNCTION public.capture_lead(
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL::text,
  p_company_name text DEFAULT NULL::text,
  p_sector text DEFAULT NULL::text,
  p_country text DEFAULT NULL::text,
  p_source text DEFAULT 'website'::text,
  p_source_url text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_normalized_email text;
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
BEGIN
  v_normalized_email := lower(trim(coalesce(p_email, '')));
  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'service_role' THEN
    UPDATE public.advisory_clients
    SET
      name = coalesce(p_name, name),
      phone = coalesce(p_phone, phone),
      company_name = coalesce(p_company_name, company_name),
      sector = coalesce(p_sector, sector),
      country = coalesce(p_country, country),
      source = coalesce(p_source, source),
      source_url = coalesce(p_source_url, source_url),
      status = coalesce(status, 'lead'),
      updated_at = now()
    WHERE email = v_normalized_email
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      INSERT INTO public.advisory_clients (
        name,email,phone,company_name,sector,country,status,source,source_url
      ) VALUES (
        p_name,v_normalized_email,p_phone,p_company_name,p_sector,p_country,
        'lead',p_source,p_source_url
      )
      RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
  END IF;

  INSERT INTO public.advisory_clients (
    name,email,phone,company_name,sector,country,status,source,source_url
  ) VALUES (
    p_name,v_normalized_email,p_phone,p_company_name,p_sector,p_country,
    'lead',p_source,p_source_url
  )
  ON CONFLICT (email) WHERE email IS NOT NULL
  DO NOTHING;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.capture_lead(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_lead(text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;
