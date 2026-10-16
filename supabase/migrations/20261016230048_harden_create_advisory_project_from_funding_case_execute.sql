-- Reconciled from production migration ledger 20261016230048 (harden_create_advisory_project_from_funding_case_execute).
REVOKE EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid) TO service_role;
