-- Assistant Phase 2: Human Approval Queue.
-- Human approval is durable review evidence only. It never grants execution authority.

CREATE TABLE IF NOT EXISTS public.assistant_human_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  boundary text NOT NULL,
  workflow_version bigint NOT NULL CHECK (workflow_version > 0),
  action_id text NOT NULL,
  action_type text NOT NULL,
  action_target text,
  action_fingerprint text NOT NULL CHECK (action_fingerprint ~ '^[a-f0-9]{64}$'),
  risk text NOT NULL CHECK (risk IN ('high','critical')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  action_snapshot jsonb NOT NULL DEFAULT '{}',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(request_key) BETWEEN 1 AND 220),
  CHECK (char_length(boundary) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_assistant_human_approvals_queue
  ON public.assistant_human_approvals (status, risk, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_human_approvals_user
  ON public.assistant_human_approvals (user_id, requested_at DESC);

ALTER TABLE public.assistant_human_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.assistant_human_approvals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.assistant_human_approvals TO service_role;

COMMENT ON TABLE public.assistant_human_approvals IS
  'Human approval evidence for sensitive Assistant actions. Server-side only; approval does not authorize execution.';

INSERT INTO public.admin_permissions(permission, description, risk_level) VALUES
('human_approval.read','Read Assistant Human Approval Queue','sensitive'),
('human_approval.decide','Approve or reject Assistant Human Approval requests','sensitive')
ON CONFLICT (permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role, permission)
SELECT role, permission FROM (VALUES
  ('super_admin','human_approval.read'),
  ('super_admin','human_approval.decide'),
  ('admin','human_approval.read'),
  ('admin','human_approval.decide')
) AS x(role, permission)
ON CONFLICT (role, permission) DO NOTHING;
