-- Agent Inbox: durable operational queue for human review.
-- Server/admin API only. No direct browser table access.

CREATE TABLE IF NOT EXISTS public.assistant_agent_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('assistant_event','workflow','document','funding_case','system')),
  source_event_id text,
  event_type text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workflow_key text,
  boundary text,
  resource_id text,
  reason_code text NOT NULL,
  title_ar text NOT NULL,
  title_en text,
  summary_ar text,
  summary_en text,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','in_review','waiting_user','resolved','dismissed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(item_key) BETWEEN 1 AND 220),
  CHECK (boundary IS NULL OR char_length(boundary) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_assistant_agent_inbox_status_priority
  ON public.assistant_agent_inbox (status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_agent_inbox_assignee
  ON public.assistant_agent_inbox (assigned_to, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_agent_inbox_user
  ON public.assistant_agent_inbox (user_id, created_at DESC);

ALTER TABLE public.assistant_agent_inbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.assistant_agent_inbox FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.assistant_agent_inbox TO service_role;

COMMENT ON TABLE public.assistant_agent_inbox IS
  'Human-review operational queue for BONDS Assistant. Accessed through admin API only.';


INSERT INTO public.admin_permissions(permission, description, risk_level) VALUES
('agent_inbox.read','Read Assistant Agent Inbox','normal'),
('agent_inbox.write','Assign and resolve Assistant Agent Inbox items','normal')
ON CONFLICT (permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role, permission)
SELECT role, permission FROM (VALUES
  ('super_admin','agent_inbox.read'),('super_admin','agent_inbox.write'),
  ('admin','agent_inbox.read'),('admin','agent_inbox.write'),
  ('support','agent_inbox.read'),('support','agent_inbox.write')
) AS x(role, permission)
ON CONFLICT (role, permission) DO NOTHING;
