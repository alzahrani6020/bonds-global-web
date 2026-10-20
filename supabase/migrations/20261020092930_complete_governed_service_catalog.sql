BEGIN;

-- Complete definitions consumed by the existing enabled service manifests.
-- No role memberships, role grants, plan grants, overrides or user data change.
-- The existing action enum uses 'view' for capability-use permissions; the
-- canonical permission codes remain the manifest's explicit '.execute' codes.
INSERT INTO public.enterprise_permissions (code, module, action, description)
VALUES
  ('research.intelligence.execute', 'research_intelligence', 'view',
   'Execute governed Research Intelligence capabilities'),
  ('orchestrator.execute', 'orchestrator', 'view',
   'Execute governed Orchestrator capabilities')
ON CONFLICT (code) DO NOTHING;

-- A definition must not silently grant a service to a user or subscription.
-- Existing administrators must record the intended plan/override and role
-- permission through the current governance controls before acceptance.
INSERT INTO public.admin_entitlements (key, description, value_type, default_value)
VALUES
  ('research.intelligence', 'Access to governed Research Intelligence service',
   'boolean', 'false'::jsonb),
  ('orchestrator', 'Access to governed Orchestrator service',
   'boolean', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- The disabled Agent Runtime is intentionally outside this release's grants.
COMMIT;
