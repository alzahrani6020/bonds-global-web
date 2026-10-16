-- Reconciled from production migration ledger 20261016230800 (close_rpc_p1_global_search_advisory_capture).
-- Close P1 RPC execution surface without changing function bodies.

REVOKE EXECUTE ON FUNCTION public.global_search(text, integer, text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer, text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.capture_lead(text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_lead(text, text, text, text, text, text, text, text)
  TO service_role;
