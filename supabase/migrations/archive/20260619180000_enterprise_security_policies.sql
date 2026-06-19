-- Enterprise Security Hardening: RLS and audit policies

-- Helper: user owns the record or is manager/admin
CREATE OR REPLACE FUNCTION public.is_owner_or_manager(p_owner_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN p_owner_id = auth.uid() OR public.is_advisory_manager();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tighten advisory clients: users see only assigned/created records unless manager
DROP POLICY IF EXISTS advisory_clients_select ON public.advisory_clients;
CREATE POLICY advisory_clients_select ON public.advisory_clients FOR SELECT TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR deleted_at IS NULL
  );

DROP POLICY IF EXISTS advisory_clients_modify ON public.advisory_clients;
CREATE POLICY advisory_clients_modify ON public.advisory_clients FOR ALL TO authenticated
  USING (public.is_advisory_manager() OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.is_advisory_manager() OR assigned_to = auth.uid() OR created_by = auth.uid());

-- Tighten advisory projects
DROP POLICY IF EXISTS advisory_projects_select ON public.advisory_projects;
CREATE POLICY advisory_projects_select ON public.advisory_projects FOR SELECT TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS advisory_projects_modify ON public.advisory_projects;
CREATE POLICY advisory_projects_modify ON public.advisory_projects FOR ALL TO authenticated
  USING (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_advisory_manager()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- Recovery assets ownership
DROP POLICY IF EXISTS recovery_assets_select ON public.recovery_assets;
CREATE POLICY recovery_assets_select ON public.recovery_assets FOR SELECT TO authenticated
  USING (public.is_advisory_manager() OR created_by = auth.uid());

DROP POLICY IF EXISTS recovery_assets_modify ON public.recovery_assets;
CREATE POLICY recovery_assets_modify ON public.recovery_assets FOR ALL TO authenticated
  USING (public.is_advisory_manager() OR created_by = auth.uid())
  WITH CHECK (public.is_advisory_manager() OR created_by = auth.uid());

-- Prevent access to soft-deleted records for non-managers
ALTER POLICY advisory_clients_select ON public.advisory_clients USING (
  public.is_advisory_manager()
  OR (
    deleted_at IS NULL
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
  )
);

ALTER POLICY advisory_projects_select ON public.advisory_projects USING (
  public.is_advisory_manager()
  OR (
    deleted_at IS NULL
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.advisory_clients c
        WHERE c.id = advisory_projects.client_id
          AND c.deleted_at IS NULL
          AND (c.assigned_to = auth.uid() OR c.created_by = auth.uid())
      )
    )
  )
);
