-- Reconciled from production migration ledger 20261016231103 (restore_capture_lead_public_intake_execute).
REVOKE EXECUTE ON FUNCTION public.capture_lead(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_lead(text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;
