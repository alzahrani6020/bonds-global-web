-- Reconciled from production migration ledger 20261016223819 (harden_funding_transition_notification_templates_rls).
ALTER TABLE public.funding_case_allowed_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_allowed_transitions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.funding_case_allowed_transitions FROM anon, authenticated;
DROP POLICY IF EXISTS funding_case_allowed_transitions_service_all ON public.funding_case_allowed_transitions;
CREATE POLICY funding_case_allowed_transitions_service_all
  ON public.funding_case_allowed_transitions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_templates FROM anon, authenticated;
DROP POLICY IF EXISTS notification_templates_service_all ON public.notification_templates;
CREATE POLICY notification_templates_service_all
  ON public.notification_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
