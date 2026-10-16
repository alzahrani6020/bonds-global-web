-- Reconciled from production migration ledger 20261016225252 (harden_grant_all_permissions_execute).
REVOKE EXECUTE ON FUNCTION public.grant_all_permissions(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_all_permissions(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_all_permissions(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_all_permissions(text) FROM service_role;
