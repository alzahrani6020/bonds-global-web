-- Allow authenticated users to self-serve in the client portal:
-- 1. Create and manage their own advisory client record.
-- 2. Create and view projects linked to their own client record.
-- This removes the barrier where a new user cannot use the client portal until an admin manually creates records.

-- =====================================================
-- advisory_clients: self-service for authenticated users
-- =====================================================
DROP POLICY IF EXISTS advisory_clients_select ON public.advisory_clients;
CREATE POLICY advisory_clients_select ON public.advisory_clients
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_advisory_user()
  );

DROP POLICY IF EXISTS advisory_clients_modify ON public.advisory_clients;
CREATE POLICY advisory_clients_modify ON public.advisory_clients
  FOR ALL TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_advisory_user()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR public.is_advisory_user()
  );

-- =====================================================
-- advisory_projects: self-service for project owners
-- =====================================================
DROP POLICY IF EXISTS advisory_projects_select ON public.advisory_projects;
CREATE POLICY advisory_projects_select ON public.advisory_projects
  FOR SELECT TO authenticated
  USING (
    public.is_advisory_user()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS advisory_projects_modify ON public.advisory_projects;
CREATE POLICY advisory_projects_modify ON public.advisory_projects
  FOR ALL TO authenticated
  USING (
    public.is_advisory_user()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_advisory_user()
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = advisory_projects.client_id
        AND c.auth_user_id = auth.uid()
    )
  );
