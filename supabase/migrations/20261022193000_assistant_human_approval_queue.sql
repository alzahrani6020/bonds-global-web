-- Assistant Phase 2: Human Approval Queue.
-- Reuse the existing admin_approval_requests control-plane table.
-- Human approval is evidence only and never grants execution authority.

ALTER TABLE public.admin_approval_requests
  ADD COLUMN IF NOT EXISTS request_key text,
  ADD COLUMN IF NOT EXISTS workflow_key text,
  ADD COLUMN IF NOT EXISTS boundary text,
  ADD COLUMN IF NOT EXISTS workflow_version bigint,
  ADD COLUMN IF NOT EXISTS action_fingerprint text,
  ADD COLUMN IF NOT EXISTS risk text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_approval_requests_request_key
  ON public.admin_approval_requests (request_key)
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_assistant_queue
  ON public.admin_approval_requests (permission, status, risk, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='admin_approval_requests_assistant_risk_check'
      AND conrelid='public.admin_approval_requests'::regclass
  ) THEN
    ALTER TABLE public.admin_approval_requests
      ADD CONSTRAINT admin_approval_requests_assistant_risk_check
      CHECK (risk IS NULL OR risk IN ('high','critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='admin_approval_requests_action_fingerprint_check'
      AND conrelid='public.admin_approval_requests'::regclass
  ) THEN
    ALTER TABLE public.admin_approval_requests
      ADD CONSTRAINT admin_approval_requests_action_fingerprint_check
      CHECK (action_fingerprint IS NULL OR action_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

REVOKE ALL ON public.admin_approval_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_approval_requests TO service_role;

INSERT INTO public.admin_permissions(permission, description, risk_level) VALUES
('assistant.human_approval','Assistant sensitive action approval request','critical'),
('human_approval.read','Read Assistant Human Approval Queue','high'),
('human_approval.decide','Approve or reject Assistant Human Approval requests','critical')
ON CONFLICT (permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role, permission)
SELECT role, permission FROM (VALUES
  ('super_admin','human_approval.read'),
  ('super_admin','human_approval.decide'),
  ('admin','human_approval.read'),
  ('admin','human_approval.decide')
) AS x(role, permission)
ON CONFLICT (role, permission) DO NOTHING;

COMMENT ON COLUMN public.admin_approval_requests.request_key IS
  'Optional idempotency key for governed approval workflows; Assistant uses an opaque hash.';
COMMENT ON COLUMN public.admin_approval_requests.action_fingerprint IS
  'Exact sensitive action fingerprint. Approval never grants execution authority.';
