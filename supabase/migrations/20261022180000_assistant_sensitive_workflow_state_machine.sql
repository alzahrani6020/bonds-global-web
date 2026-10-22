-- Assistant Phase 2 sensitive workflow state machine.
-- Hardens the existing workflow store so sensitive state can only change through
-- the dedicated atomic transition function. This metadata never executes a
-- business submission and never grants Assistant capability authorization.

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
  v_next_state jsonb;
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

  -- Never accept sensitive_state from the generic save surface.
  v_next_state := p_state - 'sensitive_state';

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

    -- Preserve the governed sensitive state across ordinary context saves.
    IF v_row.state ? 'sensitive_state' THEN
      v_next_state := v_next_state || jsonb_build_object(
        'sensitive_state',
        v_row.state -> 'sensitive_state'
      );
    END IF;

    UPDATE public.assistant_workflow_state
       SET status = p_status,
           state = v_next_state,
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
      v_next_state
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$workflow$;

CREATE OR REPLACE FUNCTION public.assistant_transition_sensitive_workflow_state(
  p_user_id uuid,
  p_workflow_key text,
  p_to_state text,
  p_expected_version bigint,
  p_boundary text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $transition$
DECLARE
  v_row public.assistant_workflow_state;
  v_from_state text;
  v_next_state jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'SENSITIVE_WORKFLOW_USER_REQUIRED';
  END IF;
  IF p_workflow_key IS NULL OR btrim(p_workflow_key) = '' THEN
    RAISE EXCEPTION 'INVALID_WORKFLOW_KEY';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'SENSITIVE_WORKFLOW_VERSION_REQUIRED';
  END IF;
  IF p_to_state NOT IN ('draft','ready','confirmed','submitted','completed','failed') THEN
    RAISE EXCEPTION 'INVALID_SENSITIVE_WORKFLOW_STATE';
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
  IF v_row.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'SENSITIVE_WORKFLOW_STATUS_BLOCKED';
  END IF;
  IF p_boundary IS NOT NULL AND btrim(p_boundary) <> '' AND v_row.boundary <> p_boundary THEN
    RAISE EXCEPTION 'SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT';
  END IF;
  IF v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'WORKFLOW_VERSION_CONFLICT';
  END IF;

  v_from_state := COALESCE(v_row.state ->> 'sensitive_state', 'draft');
  IF v_from_state NOT IN ('draft','ready','confirmed','submitted','completed','failed') THEN
    RAISE EXCEPTION 'INVALID_SENSITIVE_WORKFLOW_STATE';
  END IF;

  IF v_from_state = p_to_state THEN
    RETURN jsonb_build_object(
      'workflow', to_jsonb(v_row),
      'from_state', v_from_state,
      'to_state', p_to_state,
      'replayed', true
    );
  END IF;

  IF NOT (
       (v_from_state = 'draft'     AND p_to_state = 'ready')
    OR (v_from_state = 'ready'     AND p_to_state IN ('draft','confirmed'))
    OR (v_from_state = 'confirmed' AND p_to_state IN ('ready','submitted'))
    OR (v_from_state = 'submitted' AND p_to_state IN ('completed','failed'))
    OR (v_from_state = 'failed'    AND p_to_state = 'ready')
  ) THEN
    RAISE EXCEPTION 'SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED';
  END IF;

  v_next_state :=
    (v_row.state - 'sensitive_state' - 'last_action' - 'updated_at')
    || jsonb_build_object(
      'sensitive_state', p_to_state,
      'last_action', jsonb_build_object(
        'type', 'sensitive_workflow_transition',
        'from_state', v_from_state,
        'to_state', p_to_state,
        'reason', left(COALESCE(p_reason,''), 300)
      ),
      'updated_at', to_jsonb(clock_timestamp())
    );

  UPDATE public.assistant_workflow_state
     SET status = CASE WHEN p_to_state = 'completed' THEN 'completed' ELSE v_row.status END,
         state = v_next_state,
         version = v_row.version + 1,
         updated_at = now()
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'workflow', to_jsonb(v_row),
    'from_state', v_from_state,
    'to_state', p_to_state,
    'replayed', false
  );
END;
$transition$;

REVOKE ALL ON FUNCTION public.assistant_save_workflow_state(uuid,text,text,text,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_transition_sensitive_workflow_state(uuid,text,text,bigint,text,text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assistant_save_workflow_state(uuid,text,text,text,jsonb,bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_transition_sensitive_workflow_state(uuid,text,text,bigint,text,text)
  TO service_role;

COMMENT ON FUNCTION public.assistant_transition_sensitive_workflow_state(uuid,text,text,bigint,text,text) IS
'Atomic Assistant sensitive workflow metadata transition. Does not execute or authorize a business action.';

NOTIFY pgrst, 'reload schema';
