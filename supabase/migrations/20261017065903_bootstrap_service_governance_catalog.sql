BEGIN;

INSERT INTO public.enterprise_permissions (
  code,
  module,
  action,
  description
)
VALUES
  (
    'ai.native.use',
    'ai_native',
    'view',
    'Use Bonds Native Inference capabilities'
  ),
  (
    'research.web.read',
    'research_web',
    'view',
    'Use governed web research capabilities'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.admin_entitlements (
  key,
  description,
  value_type,
  default_value
)
VALUES
  (
    'ai.native',
    'Access to Bonds Native Inference service',
    'boolean',
    'true'::jsonb
  ),
  (
    'research.web',
    'Access to governed web research service',
    'boolean',
    'true'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_feature_flags (
  key,
  description,
  enabled,
  default_variant,
  rollout_percentage
)
VALUES
  (
    'service.native-inference.enabled',
    'Enable Bonds Native Inference service',
    true,
    'on',
    100
  ),
  (
    'service.web-research.enabled',
    'Enable governed web research service',
    true,
    'on',
    100
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;