-- Reconciled from production migration ledger 20261016232602 (harden_residual_security_definer_execute).
-- Trigger-only and internal worker functions are not Data API endpoints.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.link_client_to_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.link_user_to_client() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_ingredient_price_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_default_assessment_due_date() FROM PUBLIC, anon, authenticated, service_role;

-- Data-quality subroutines are invoked by the owner-context gated wrapper only.
REVOKE EXECUTE ON FUNCTION public.dq_find_broken_relations() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.dq_find_duplicate_clients() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.dq_find_incomplete_projects() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.dq_find_missing_fields() FROM PUBLIC, anon, authenticated, service_role;

-- Funding reference generation is an internal/service write helper.
REVOKE EXECUTE ON FUNCTION public.generate_funding_case_reference() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_funding_case_reference() TO service_role;

-- Self/role helpers used by authenticated RLS/UI flows; anonymous direct RPC is unnecessary.
REVOKE EXECUTE ON FUNCTION public.get_my_client_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_client_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_advisory_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_advisory_manager() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_advisory_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_advisory_user() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_bonds_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bonds_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_funding_case_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_funding_case_user() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_lifecycle_instance_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lifecycle_instance_participant(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_or_manager(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_valuation_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valuation_admin() TO authenticated, service_role;

-- City directory RPCs already enforce manager/admin using auth.uid(); anonymous execution is unnecessary.
REVOKE EXECUTE ON FUNCTION public.city_list_city_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_list_city_roles() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.city_search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_search_users(text) TO authenticated, service_role;
