-- Reconciled from production migration ledger 20261016230639 (harden_global_search_authorization).
CREATE OR REPLACE FUNCTION public.global_search(
  p_query text,
  p_limit integer DEFAULT 20,
  p_entity_types text[] DEFAULT NULL::text[]
)
RETURNS TABLE(entity_type text, entity_id uuid, title text, content text, rank real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    g.entity_type,
    g.entity_id,
    g.title,
    g.content,
    (
      similarity(lower(g.title), lower(p_query)) * 2.0 +
      similarity(lower(g.content), lower(p_query))
    )::real AS rank
  FROM public.global_search_index g
  WHERE
    (p_entity_types IS NULL OR g.entity_type = ANY(p_entity_types))
    AND (
      lower(g.title) % lower(p_query)
      OR lower(g.content) % lower(p_query)
      OR g.title ILIKE '%' || p_query || '%'
      OR g.content ILIKE '%' || p_query || '%'
    )
    AND (
      (g.entity_type = 'advisory_client' AND EXISTS (
        SELECT 1 FROM public.advisory_clients c
        WHERE c.id = g.entity_id
          AND c.deleted_at IS NULL
          AND (
            public.is_advisory_manager()
            OR c.auth_user_id = v_uid
            OR c.created_by = v_uid
            OR c.assigned_to = v_uid
            OR c.account_owner = v_uid
          )
      ))
      OR
      (g.entity_type = 'advisory_project' AND EXISTS (
        SELECT 1
        FROM public.advisory_projects p
        LEFT JOIN public.advisory_clients c ON c.id = p.client_id
        WHERE p.id = g.entity_id
          AND p.deleted_at IS NULL
          AND (
            public.is_advisory_manager()
            OR p.created_by = v_uid
            OR p.assigned_to = v_uid
            OR c.auth_user_id = v_uid
            OR c.account_owner = v_uid
          )
      ))
      OR
      (g.entity_type = 'recovery_asset' AND EXISTS (
        SELECT 1 FROM public.recovery_assets r
        WHERE r.id = g.entity_id
          AND r.deleted_at IS NULL
          AND (
            public.recovery_is_manager_or_admin(v_uid)
            OR r.created_by = v_uid
            OR r.assigned_manager = v_uid
          )
      ))
      OR
      (g.entity_type = 'advisory_feasibility_study' AND EXISTS (
        SELECT 1
        FROM public.advisory_feasibility_studies s
        LEFT JOIN public.advisory_projects p ON p.id = s.project_id
        LEFT JOIN public.advisory_clients c ON c.id = s.client_id
        WHERE s.id = g.entity_id
          AND (
            public.is_advisory_manager()
            OR s.created_by = v_uid
            OR p.created_by = v_uid
            OR p.assigned_to = v_uid
            OR c.auth_user_id = v_uid
            OR c.account_owner = v_uid
          )
      ))
      OR
      (g.entity_type = 'ai_advisor_report' AND EXISTS (
        SELECT 1
        FROM public.ai_advisor_reports rep
        LEFT JOIN public.advisory_clients c ON c.id = rep.client_id
        WHERE rep.id = g.entity_id
          AND (
            public.is_advisory_manager()
            OR rep.created_by = v_uid
            OR c.auth_user_id = v_uid
            OR c.account_owner = v_uid
          )
      ))
    )
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),100);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.global_search(text, integer, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.global_search(text, integer, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.global_search(text, integer, text[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer, text[]) TO authenticated;
