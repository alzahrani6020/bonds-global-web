-- Assistant V1 immutable audit trail.
-- Records assistant action lifecycle evidence only.
-- This is observability/audit data, not authorization, AI capability, API capability,
-- model/provider selection, context size, throughput, or token compute policy.

CREATE TABLE IF NOT EXISTS public.assistant_action_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id text,
    boundary text,
    action_id text,
    action_type text NOT NULL,
    target text,
    event_type text NOT NULL CHECK (
      event_type IN (
        'planned',
        'confirmation_prepared',
        'confirmation_resolved',
        'idempotency_claimed',
        'replayed',
        'write_succeeded',
        'write_uncertain',
        'denied',
        'failed'
      )
    ),
    outcome text,
    risk text,
    requires_confirmation boolean NOT NULL DEFAULT false,
    idempotency_key_hash text,
    resource_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.assistant_action_audit IS
'Immutable Assistant V1 action lifecycle audit evidence. Not an authorization or AI/API capability control.';

CREATE INDEX IF NOT EXISTS idx_assistant_action_audit_user_created
  ON public.assistant_action_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_action_audit_action
  ON public.assistant_action_audit (action_type, event_type, created_at DESC);

ALTER TABLE public.assistant_action_audit ENABLE ROW LEVEL SECURITY;

-- No direct client inserts/updates/deletes. Server-side service role owns writes.
REVOKE ALL ON public.assistant_action_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.assistant_append_action_audit(
    p_user_id uuid,
    p_session_id text,
    p_boundary text,
    p_action_id text,
    p_action_type text,
    p_target text,
    p_event_type text,
    p_outcome text DEFAULT NULL,
    p_risk text DEFAULT NULL,
    p_requires_confirmation boolean DEFAULT false,
    p_idempotency_key_hash text DEFAULT NULL,
    p_resource_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'AUDIT_USER_REQUIRED';
  END IF;

  IF p_action_type IS NULL OR btrim(p_action_type) = '' THEN
    RAISE EXCEPTION 'AUDIT_ACTION_TYPE_REQUIRED';
  END IF;

  INSERT INTO public.assistant_action_audit (
    user_id,
    session_id,
    boundary,
    action_id,
    action_type,
    target,
    event_type,
    outcome,
    risk,
    requires_confirmation,
    idempotency_key_hash,
    resource_id,
    metadata
  )
  VALUES (
    p_user_id,
    NULLIF(left(COALESCE(p_session_id, ''), 200), ''),
    NULLIF(left(COALESCE(p_boundary, ''), 500), ''),
    NULLIF(left(COALESCE(p_action_id, ''), 200), ''),
    left(p_action_type, 100),
    NULLIF(left(COALESCE(p_target, ''), 200), ''),
    p_event_type,
    NULLIF(left(COALESCE(p_outcome, ''), 100), ''),
    NULLIF(left(COALESCE(p_risk, ''), 50), ''),
    COALESCE(p_requires_confirmation, false),
    NULLIF(left(COALESCE(p_idempotency_key_hash, ''), 128), ''),
    NULLIF(left(COALESCE(p_resource_id, ''), 200), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_append_action_audit(
  uuid,text,text,text,text,text,text,text,text,boolean,text,text,jsonb
) FROM PUBLIC, anon, authenticated;
