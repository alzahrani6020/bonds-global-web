-- Reconciled from production migration ledger 20261017002051 (fix_security_definer_search_path).
ALTER FUNCTION public.create_advisory_project_from_funding_case(uuid,uuid,text,text,uuid)
  SET search_path TO public, auth;

ALTER FUNCTION public.is_bonds_admin()
  SET search_path TO public, auth;

ALTER FUNCTION public.is_funding_case_user()
  SET search_path TO public, auth;
