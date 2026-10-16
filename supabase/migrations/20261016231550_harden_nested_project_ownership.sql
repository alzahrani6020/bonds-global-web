-- Reconciled from production migration ledger 20261016231550 (harden_nested_project_ownership).
DROP POLICY IF EXISTS "Users can manage own scenarios" ON public.project_scenarios;
CREATE POLICY "Users can manage own scenarios"
  ON public.project_scenarios
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_projects p
        WHERE p.id = project_scenarios.project_id
          AND p.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_projects p
        WHERE p.id = project_scenarios.project_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS client_documents_client_insert ON public.client_documents;
CREATE POLICY client_documents_client_insert
  ON public.client_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = client_documents.client_id
        AND c.auth_user_id = auth.uid()
    )
    AND (
      client_documents.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.advisory_projects p
        WHERE p.id = client_documents.project_id
          AND p.client_id = client_documents.client_id
      )
    )
  );

DROP POLICY IF EXISTS client_documents_client_update ON public.client_documents;
CREATE POLICY client_documents_client_update
  ON public.client_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = client_documents.client_id
        AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = client_documents.client_id
        AND c.auth_user_id = auth.uid()
    )
    AND (
      client_documents.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.advisory_projects p
        WHERE p.id = client_documents.project_id
          AND p.client_id = client_documents.client_id
      )
    )
  );
