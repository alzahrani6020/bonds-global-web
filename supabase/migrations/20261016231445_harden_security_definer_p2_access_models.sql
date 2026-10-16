-- Reconciled from production migration ledger 20261016231445 (harden_security_definer_p2_access_models).
-- Self-service reads: caller may read only self; service_role may inspect any user.
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS TABLE(permission_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ep.code
  FROM public.enterprise_user_roles eur
  JOIN public.enterprise_role_permissions erp ON erp.role_id = eur.role_id
  JOIN public.enterprise_permissions ep ON ep.id = erp.permission_id
  WHERE eur.user_id = p_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_limits(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE
  v_tier text;
  v_status text;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  SELECT tier,status INTO v_tier,v_status
  FROM public.subscriptions
  WHERE user_id=p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_status := 'inactive';
  END IF;

  RETURN json_build_object(
    'tier',v_tier,'status',v_status,
    'maxScenarios',case when v_tier in ('pro','enterprise') then null else 3 end,
    'maxCountries',case when v_tier in ('pro','enterprise') then null else 5 end,
    'pdfExport',v_tier in ('pro','enterprise') and v_status='active',
    'healthHistory',v_tier in ('pro','enterprise') and v_status='active',
    'apiAccess',v_tier in ('pro','enterprise') and v_status='active',
    'webhooks',v_tier='enterprise' and v_status='active',
    'emailParser',v_tier='enterprise' and v_status='active',
    'prioritySupport',v_tier='enterprise' and v_status='active'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_limits(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_limits(uuid) TO authenticated, service_role;

-- Policy helpers: preserve authenticated policy use but bind direct calls to self.
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM user_uuid THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id=user_uuid
      AND admin_roles.role IN ('super_admin','admin','support')
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.city_is_manager_or_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM user_uuid THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.city_roles
    WHERE city_roles.user_id=user_uuid
      AND city_roles.role IN ('admin','analyst')
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id=user_uuid
      AND admin_roles.role IN ('super_admin','admin')
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.city_is_manager_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_is_manager_or_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recovery_is_manager_or_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM user_uuid THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles
    WHERE recovery_roles.user_id=user_uuid
      AND recovery_roles.role IN ('admin','manager')
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id=user_uuid
      AND admin_roles.role IN ('super_admin','admin')
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recovery_is_manager_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recovery_is_manager_or_admin(uuid) TO authenticated, service_role;

-- Data quality: authenticated managers may run full check; internal helpers are not public APIs.
CREATE OR REPLACE FUNCTION public.dq_run_all_checks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE
  v_dup bigint;
  v_miss bigint;
  v_broken bigint;
  v_incomp bigint;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     AND NOT public.is_advisory_manager() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  PERFORM public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  RETURN jsonb_build_object(
    'duplicates',v_dup,'missing_fields',v_miss,
    'broken_relations',v_broken,'incomplete_projects',v_incomp
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dq_run_all_checks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dq_run_all_checks() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.clear_data_quality_issues(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_data_quality_issues(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_global_search_index() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_global_search_index() TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_system(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_system(text,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.next_bonds_sequence(text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_bonds_sequence(text,integer,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.workflow_allowed_states(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_allowed_states(text,uuid) TO service_role;
