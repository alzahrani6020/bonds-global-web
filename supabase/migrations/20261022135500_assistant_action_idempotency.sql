-- BONDS Assistant persistent write idempotency ledger.
-- Server-side/service-role only. This ledger is replay protection, not authorization.

CREATE TABLE IF NOT EXISTS public.assistant_action_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  action_type text NOT NULL,
  action_target text,
  action_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','succeeded','uncertain')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_action_idempotency_user_key_unique
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_assistant_action_idempotency_user_created
  ON public.assistant_action_idempotency(user_id, created_at DESC);

ALTER TABLE public.assistant_action_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_action_idempotency FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.assistant_claim_idempotency(
  p_user_id uuid,
  p_idempotency_key text,
  p_action_type text,
  p_action_target text,
  p_action_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_count integer := 0;
  existing public.assistant_action_idempotency%ROWTYPE;
BEGIN
  IF p_user_id IS NULL
     OR length(coalesce(p_idempotency_key, '')) <> 64
     OR p_idempotency_key !~ '^[0-9a-f]{64}$'
     OR length(coalesce(p_action_type, '')) = 0
     OR length(coalesce(p_action_fingerprint, '')) <> 64
     OR p_action_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_CLAIM';
  END IF;

  INSERT INTO public.assistant_action_idempotency (
    user_id,
    idempotency_key,
    action_type,
    action_target,
    action_fingerprint,
    status
  )
  VALUES (
    p_user_id,
    p_idempotency_key,
    p_action_type,
    nullif(p_action_target, ''),
    p_action_fingerprint,
    'started'
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT *
    INTO existing
    FROM public.assistant_action_idempotency
   WHERE user_id = p_user_id
     AND idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IDEMPOTENCY_LEDGER_READ_FAILED';
  END IF;

  IF existing.action_fingerprint <> p_action_fingerprint
     OR existing.action_type <> p_action_type
     OR coalesce(existing.action_target, '') <> coalesce(p_action_target, '') THEN
    RETURN jsonb_build_object(
      'state', 'key_conflict',
      'status', existing.status
    );
  END IF;

  IF inserted_count = 1 THEN
    RETURN jsonb_build_object(
      'state', 'claimed',
      'status', existing.status
    );
  END IF;

  IF existing.status = 'succeeded' THEN
    RETURN jsonb_build_object(
      'state', 'replay_succeeded',
      'status', existing.status,
      'result', existing.result
    );
  END IF;

  IF existing.status = 'uncertain' THEN
    RETURN jsonb_build_object(
      'state', 'uncertain',
      'status', existing.status
    );
  END IF;

  RETURN jsonb_build_object(
    'state', 'in_progress',
    'status', existing.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_resolve_idempotency(
  p_user_id uuid,
  p_idempotency_key text,
  p_action_fingerprint text,
  p_status text,
  p_result jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed_count integer := 0;
  existing public.assistant_action_idempotency%ROWTYPE;
BEGIN
  IF p_status NOT IN ('succeeded','uncertain') THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_STATUS';
  END IF;

  UPDATE public.assistant_action_idempotency
     SET status = p_status,
         result = CASE WHEN p_status = 'succeeded' THEN p_result ELSE NULL END,
         updated_at = now()
   WHERE user_id = p_user_id
     AND idempotency_key = p_idempotency_key
     AND action_fingerprint = p_action_fingerprint
     AND status = 'started';

  GET DIAGNOSTICS changed_count = ROW_COUNT;

  SELECT *
    INTO existing
    FROM public.assistant_action_idempotency
   WHERE user_id = p_user_id
     AND idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'missing');
  END IF;

  IF existing.action_fingerprint <> p_action_fingerprint THEN
    RETURN jsonb_build_object('state', 'key_conflict', 'status', existing.status);
  END IF;

  IF changed_count = 1 THEN
    RETURN jsonb_build_object(
      'state', CASE WHEN p_status = 'succeeded' THEN 'resolved_succeeded' ELSE 'resolved_uncertain' END,
      'status', existing.status,
      'result', existing.result
    );
  END IF;

  IF existing.status = 'succeeded' THEN
    RETURN jsonb_build_object(
      'state', 'replay_succeeded',
      'status', existing.status,
      'result', existing.result
    );
  END IF;

  RETURN jsonb_build_object(
    'state', existing.status,
    'status', existing.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_claim_idempotency(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_resolve_idempotency(uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assistant_action_idempotency TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_claim_idempotency(uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_resolve_idempotency(uuid,text,text,text,jsonb) TO service_role;
