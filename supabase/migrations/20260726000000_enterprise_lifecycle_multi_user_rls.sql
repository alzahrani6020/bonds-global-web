-- Phase E.0 — Multi-user Lifecycle RLS
-- Relaxes user-only RLS on Enterprise Lifecycle tables so that approvers
-- and other participants can read lifecycle context and submit approval decisions.
-- Write access remains restricted to the instance creator except for approvals,
-- where participants may update pending approvals to record their decisions.

-- Helper: determine whether the current auth user is a participant in a lifecycle instance.
-- A participant is the instance creator, the approval requester, or anyone who has
-- recorded a decision on any approval belonging to the instance.
CREATE OR REPLACE FUNCTION public.is_lifecycle_instance_participant(p_instance_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = p_instance_id AND i.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_approvals a
    WHERE a.instance_id = p_instance_id AND a.requested_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_approvals a
    WHERE a.instance_id = p_instance_id
      AND a.decisions @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text))
  );
END;
$$;

COMMENT ON FUNCTION public.is_lifecycle_instance_participant(UUID) IS
  'Returns true if the current user is a participant in the given lifecycle instance.';

-- Grant execute to authenticated users.
GRANT EXECUTE ON FUNCTION public.is_lifecycle_instance_participant(UUID) TO authenticated;

-- Instances: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_instances_own ON public.enterprise_lifecycle_instances;
CREATE POLICY el_instances_participant_select ON public.enterprise_lifecycle_instances
  FOR SELECT USING (public.is_lifecycle_instance_participant(id));
CREATE POLICY el_instances_creator_modify ON public.enterprise_lifecycle_instances
  FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Transitions: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_transitions_own ON public.enterprise_lifecycle_transitions;
CREATE POLICY el_transitions_participant_select ON public.enterprise_lifecycle_transitions
  FOR SELECT USING (public.is_lifecycle_instance_participant(instance_id));
CREATE POLICY el_transitions_creator_modify ON public.enterprise_lifecycle_transitions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_transitions.instance_id AND i.created_by = auth.uid()
  ));

-- Gate evaluations: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_gate_evaluations_own ON public.enterprise_lifecycle_gate_evaluations;
CREATE POLICY el_gate_evaluations_participant_select ON public.enterprise_lifecycle_gate_evaluations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_transitions t
    JOIN public.enterprise_lifecycle_instances i ON i.id = t.instance_id
    WHERE t.id = enterprise_lifecycle_gate_evaluations.transition_id
      AND public.is_lifecycle_instance_participant(i.id)
  ));
CREATE POLICY el_gate_evaluations_creator_modify ON public.enterprise_lifecycle_gate_evaluations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_transitions t
    JOIN public.enterprise_lifecycle_instances i ON i.id = t.instance_id
    WHERE t.id = enterprise_lifecycle_gate_evaluations.transition_id AND i.created_by = auth.uid()
  ));

-- Approvals: participants can read and update pending approvals (to record decisions);
-- only the creator can delete or perform other modifications.
DROP POLICY IF EXISTS el_approvals_own ON public.enterprise_lifecycle_approvals;
CREATE POLICY el_approvals_participant_select ON public.enterprise_lifecycle_approvals
  FOR SELECT USING (public.is_lifecycle_instance_participant(instance_id));
CREATE POLICY el_approvals_participant_update ON public.enterprise_lifecycle_approvals
  FOR UPDATE USING (
    public.is_lifecycle_instance_participant(instance_id)
    AND status = 'pending'
  ) WITH CHECK (
    public.is_lifecycle_instance_participant(instance_id)
  );
CREATE POLICY el_approvals_creator_all ON public.enterprise_lifecycle_approvals
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_approvals.instance_id AND i.created_by = auth.uid()
  ));

-- Tasks: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_tasks_own ON public.enterprise_lifecycle_tasks;
CREATE POLICY el_tasks_participant_select ON public.enterprise_lifecycle_tasks
  FOR SELECT USING (public.is_lifecycle_instance_participant(instance_id));
CREATE POLICY el_tasks_creator_modify ON public.enterprise_lifecycle_tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_tasks.instance_id AND i.created_by = auth.uid()
  ));

-- Events: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_events_own ON public.enterprise_lifecycle_events;
CREATE POLICY el_events_participant_select ON public.enterprise_lifecycle_events
  FOR SELECT USING (public.is_lifecycle_instance_participant(instance_id));
CREATE POLICY el_events_creator_modify ON public.enterprise_lifecycle_events
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_events.instance_id AND i.created_by = auth.uid()
  ));

-- Timeline: participants can read; only creator can modify.
DROP POLICY IF EXISTS el_timeline_own ON public.enterprise_lifecycle_timeline;
CREATE POLICY el_timeline_participant_select ON public.enterprise_lifecycle_timeline
  FOR SELECT USING (public.is_lifecycle_instance_participant(instance_id));
CREATE POLICY el_timeline_creator_modify ON public.enterprise_lifecycle_timeline
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_timeline.instance_id AND i.created_by = auth.uid()
  ));
