-- Enterprise Workflow Engine
-- Tracks state-machine transitions for clients, projects, assets, studies, funding requests.

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL UNIQUE CHECK (entity_type IN ('advisory_client','advisory_project','advisory_feasibility_study','advisory_financial_model','recovery_asset','recovery_plan','funding_request')),
  name text NOT NULL,
  initial_state text NOT NULL,
  states text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  from_state text NOT NULL,
  to_state text NOT NULL,
  required_role text,
  requires_approval boolean NOT NULL DEFAULT false,
  required_rules jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, from_state, to_state)
);

CREATE TABLE IF NOT EXISTS public.entity_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  current_state text NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_workflows_entity ON public.entity_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_workflows_state ON public.entity_workflows(current_state);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_entity ON public.workflow_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_created_at ON public.workflow_audit_log(created_at DESC);

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_defs_read ON public.workflow_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY workflow_transitions_read ON public.workflow_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY entity_workflows_all ON public.entity_workflows FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());
CREATE POLICY workflow_audit_read ON public.workflow_audit_log FOR SELECT TO authenticated USING (public.is_advisory_user());

-- Trigger: update updated_at
DROP TRIGGER IF EXISTS trg_entity_workflows_updated_at ON public.entity_workflows;
CREATE TRIGGER trg_entity_workflows_updated_at BEFORE UPDATE ON public.entity_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed workflow definitions and transitions
INSERT INTO public.workflow_definitions (entity_type, name, initial_state, states) VALUES
  ('advisory_project', 'Advisory Project Workflow', 'draft', ARRAY['draft','lead','proposal','active','on_hold','completed','cancelled']),
  ('recovery_asset', 'Recovery Asset Workflow', 'identified', ARRAY['identified','valuation','planning','active_rescue','restructuring','recovered','liquidated','write_off']),
  ('funding_request', 'Funding Request Workflow', 'draft', ARRAY['draft','submitted','under_review','approved','rejected','funded'])
ON CONFLICT (entity_type) DO NOTHING;

DO $$
DECLARE v_proj uuid;
DECLARE v_asset uuid;
DECLARE v_fund uuid;
BEGIN
  SELECT id INTO v_proj FROM public.workflow_definitions WHERE entity_type = 'advisory_project';
  SELECT id INTO v_asset FROM public.workflow_definitions WHERE entity_type = 'recovery_asset';
  SELECT id INTO v_fund FROM public.workflow_definitions WHERE entity_type = 'funding_request';

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, required_rules) VALUES
    (v_proj, 'draft', 'lead', '["hasClient"]'),
    (v_proj, 'lead', 'proposal', '["hasClient"]'),
    (v_proj, 'proposal', 'active', '["hasClient","nonEmptyBudget"]'),
    (v_proj, 'active', 'on_hold', '[]'),
    (v_proj, 'active', 'completed', '["requireEndDate"]'),
    (v_proj, 'on_hold', 'active', '[]'),
    (v_proj, 'proposal', 'cancelled', '[]'),
    (v_proj, 'active', 'cancelled', '[]')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, requires_approval, required_rules) VALUES
    (v_asset, 'identified', 'valuation', false, '["hasClient"]'),
    (v_asset, 'valuation', 'planning', false, '["nonEmptyBudget"]'),
    (v_asset, 'planning', 'active_rescue', false, '[]'),
    (v_asset, 'active_rescue', 'restructuring', false, '[]'),
    (v_asset, 'active_rescue', 'recovered', false, '[]'),
    (v_asset, 'restructuring', 'recovered', false, '[]'),
    (v_asset, 'restructuring', 'liquidated', false, '[]'),
    (v_asset, 'active_rescue', 'liquidated', false, '[]'),
    (v_asset, 'planning', 'write_off', true, '[]')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.workflow_transitions (definition_id, from_state, to_state, requires_approval, required_rules) VALUES
    (v_fund, 'draft', 'submitted', false, '["hasClient","nonEmptyBudget"]'),
    (v_fund, 'submitted', 'under_review', false, '[]'),
    (v_fund, 'under_review', 'approved', true, '[]'),
    (v_fund, 'under_review', 'rejected', true, '[]'),
    (v_fund, 'approved', 'funded', false, '[]')
  ON CONFLICT DO NOTHING;
END $$;

-- RPC: validate and perform transition
CREATE OR REPLACE FUNCTION public.workflow_transition(
  p_entity_type text,
  p_entity_id uuid,
  p_to_state text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  v_def public.workflow_definitions%ROWTYPE;
  v_ew public.entity_workflows%ROWTYPE;
  v_t public.workflow_transitions%ROWTYPE;
BEGIN
  SELECT * INTO v_def FROM public.workflow_definitions WHERE entity_type = p_entity_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workflow definition not found');
  END IF;

  SELECT * INTO v_ew FROM public.entity_workflows WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
  IF NOT FOUND THEN
    INSERT INTO public.entity_workflows (entity_type, entity_id, definition_id, current_state)
    VALUES (p_entity_type, p_entity_id, v_def.id, v_def.initial_state)
    RETURNING * INTO v_ew;
  END IF;

  SELECT * INTO v_t
  FROM public.workflow_transitions
  WHERE definition_id = v_def.id AND from_state = v_ew.current_state AND to_state = p_to_state;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', format('Transition %s -> %s is not allowed', v_ew.current_state, p_to_state));
  END IF;

  IF v_t.requires_approval AND (p_context->>'approvedBy') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval required');
  END IF;

  UPDATE public.entity_workflows SET current_state = p_to_state, updated_at = now()
  WHERE id = v_ew.id;

  INSERT INTO public.workflow_audit_log (entity_type, entity_id, from_state, to_state, actor_id, reason, metadata)
  VALUES (p_entity_type, p_entity_id, v_ew.current_state, p_to_state, p_actor_id, p_reason, p_context);

  RETURN jsonb_build_object('success', true, 'from_state', v_ew.current_state, 'to_state', p_to_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get allowed next states
CREATE OR REPLACE FUNCTION public.workflow_allowed_states(p_entity_type text, p_entity_id uuid)
RETURNS TABLE(to_state text, requires_approval boolean) AS $$
DECLARE v_def_id uuid;
DECLARE v_current text;
BEGIN
  SELECT definition_id, current_state INTO v_def_id, v_current
  FROM public.entity_workflows WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
  IF v_def_id IS NULL THEN
    SELECT id INTO v_def_id FROM public.workflow_definitions WHERE entity_type = p_entity_type;
    SELECT initial_state INTO v_current FROM public.workflow_definitions WHERE id = v_def_id;
  END IF;
  RETURN QUERY
  SELECT t.to_state, t.requires_approval
  FROM public.workflow_transitions t
  WHERE t.definition_id = v_def_id AND t.from_state = v_current;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
