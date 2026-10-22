-- Assistant Phase 2 persistent workflow state.
-- Stores bounded, resumable assistant workflow state server-side.
-- This is workflow continuity, not authorization and not AI/model/provider/API policy.

CREATE TABLE IF NOT EXISTS public.assistant_workflow_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  boundary text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workflow_key)
);

COMMENT ON TABLE public.assistant_workflow_state IS
'Persistent Assistant Phase 2 workflow continuity state. Not an authorization or AI capability control.';

CREATE INDEX IF NOT EXISTS idx_assistant_workflow_state_user_updated
  ON public.assistant_workflow_state (user_id, updated_at DESC);

ALTER TABLE public.assistant_workflow_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_workflow_state FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_save_workflow_state(
  p_user_id uuid,
  p_workflow_key text,
  p_boundary text,
  p_status text,
  p_state jsonb,
  p_expected_version bigint DEFAULT NULL
)
RETURNS public.assistant_workflow_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $workflow$
DECLARE
  v_row public.assistant_workflow_state;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'WORKFLOW_USER_REQUIRED';
  END IF;
  IF p_workflow_key IS NULL OR btrim(p_workflow_key) = '' THEN
    RAISE EXCEPTION 'INVALID_WORKFLOW_KEY';
  END IF;
  IF p_boundary IS NULL OR btrim(p_boundary) = '' THEN
    RAISE EXCEPTION 'WORKFLOW_BOUNDARY_REQUIRED';
  END IF;
  IF p_status NOT IN ('active','paused','completed','cancelled') THEN
    RAISE EXCEPTION 'INVALID_WORKFLOW_STATUS';
  END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' THEN
    RAISE EXCEPTION 'WORKFLOW_STATE_INVALID';
  END IF;

  SELECT *
    INTO v_row
    FROM public.assistant_workflow_state
   WHERE user_id = p_user_id
     AND workflow_key = p_workflow_key
   FOR UPDATE;

  IF FOUND THEN
    IF v_row.boundary <> p_boundary THEN
      RAISE EXCEPTION 'WORKFLOW_BOUNDARY_CONFLICT';
    END IF;
    IF p_expected_version IS NOT NULL AND v_row.version <> p_expected_version THEN
      RAISE EXCEPTION 'WORKFLOW_VERSION_CONFLICT';
    END IF;

    UPDATE public.assistant_workflow_state
       SET status = p_status,
           state = p_state,
           version = v_row.version + 1,
           updated_at = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  ELSE
    IF p_expected_version IS NOT NULL AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'WORKFLOW_VERSION_CONFLICT';
    END IF;

    INSERT INTO public.assistant_workflow_state (
      user_id, workflow_key, boundary, status, version, state
    )
    VALUES (
      p_user_id,
      left(p_workflow_key, 160),
      left(p_boundary, 500),
      p_status,
      1,
      p_state
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$workflow$;

CREATE OR REPLACE FUNCTION public.assistant_load_workflow_state(
  p_user_id uuid,
  p_workflow_key text
)
RETURNS public.assistant_workflow_state
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $workflow$
  SELECT *
    FROM public.assistant_workflow_state
   WHERE user_id = p_user_id
     AND workflow_key = p_workflow_key
   LIMIT 1;
$workflow$;

CREATE OR REPLACE FUNCTION public.assistant_set_workflow_status(
  p_user_id uuid,
  p_workflow_key text,
  p_status text,
  p_expected_version bigint
)
RETURNS public.assistant_workflow_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $workflow$
DECLARE
  v_row public.assistant_workflow_state;
BEGIN
  IF p_status NOT IN ('active','paused','completed','cancelled') THEN
    RAISE EXCEPTION 'INVALID_WORKFLOW_STATUS';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'WORKFLOW_VERSION_REQUIRED';
  END IF;

  SELECT *
    INTO v_row
    FROM public.assistant_workflow_state
   WHERE user_id = p_user_id
     AND workflow_key = p_workflow_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_NOT_FOUND';
  END IF;
  IF v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'WORKFLOW_VERSION_CONFLICT';
  END IF;

  UPDATE public.assistant_workflow_state
     SET status = p_status,
         version = v_row.version + 1,
         updated_at = now()
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$workflow$;

REVOKE ALL ON FUNCTION public.assistant_save_workflow_state(uuid,text,text,text,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_load_workflow_state(uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_set_workflow_status(uuid,text,text,bigint)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assistant_save_workflow_state(uuid,text,text,text,jsonb,bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_load_workflow_state(uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_set_workflow_status(uuid,text,text,bigint)
  TO service_role;

NOTIFY pgrst, 'reload schema';
