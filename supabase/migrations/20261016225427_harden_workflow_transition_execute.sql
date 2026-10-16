-- Reconciled from production migration ledger 20261016225427 (harden_workflow_transition_execute).
REVOKE EXECUTE ON FUNCTION public.workflow_transition(text, uuid, text, uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.workflow_transition(text, uuid, text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.workflow_transition(text, uuid, text, uuid, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.workflow_transition(text, uuid, text, uuid, text, jsonb) FROM service_role;
