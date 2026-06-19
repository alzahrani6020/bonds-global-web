-- Client Portal Schema Additions
-- Links authenticated portal users to advisory client records and exposes read-only views.

-- Link advisory_clients to auth.users so clients can log in to the portal
ALTER TABLE public.advisory_clients
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_advisory_clients_auth_user_id ON public.advisory_clients(auth_user_id);

-- Link AI advisor reports to advisory_clients so generated reports can be shared
ALTER TABLE public.ai_advisor_reports
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_advisor_reports_client_id ON public.ai_advisor_reports(client_id);

-- Helper: normalize email for reliable matching
CREATE OR REPLACE FUNCTION public.normalize_email(p_email text)
RETURNS text AS $$
BEGIN
  RETURN lower(trim(coalesce(p_email, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- When a new auth user is created, automatically link them to an advisory client with the same email
CREATE OR REPLACE FUNCTION public.link_client_to_user()
RETURNS trigger AS $$
BEGIN
  UPDATE public.advisory_clients
  SET auth_user_id = NEW.id
  WHERE auth_user_id IS NULL
    AND public.normalize_email(email) = public.normalize_email(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_link_client_to_user ON auth.users;
CREATE TRIGGER trg_link_client_to_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_client_to_user();

-- When a client record is created/updated, link it to an existing auth user with the same email
CREATE OR REPLACE FUNCTION public.link_user_to_client()
RETURNS trigger AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.auth_user_id IS NULL THEN
    UPDATE public.advisory_clients c
    SET auth_user_id = u.id
    FROM auth.users u
    WHERE c.id = NEW.id
      AND c.auth_user_id IS NULL
      AND public.normalize_email(u.email) = public.normalize_email(NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_link_user_to_client ON public.advisory_clients;
CREATE TRIGGER trg_link_user_to_client
AFTER INSERT OR UPDATE OF email ON public.advisory_clients
FOR EACH ROW EXECUTE FUNCTION public.link_user_to_client();

-- Client read-only policies for the portal

-- Client can view their own advisory client record
DROP POLICY IF EXISTS advisory_clients_client_select ON public.advisory_clients;
CREATE POLICY advisory_clients_client_select ON public.advisory_clients FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

-- Client can view their projects
DROP POLICY IF EXISTS advisory_projects_client_select ON public.advisory_projects;
CREATE POLICY advisory_projects_client_select ON public.advisory_projects FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = advisory_projects.client_id AND c.auth_user_id = auth.uid()
  ));

-- Client can view their feasibility studies
DROP POLICY IF EXISTS advisory_feasibility_studies_client_select ON public.advisory_feasibility_studies;
CREATE POLICY advisory_feasibility_studies_client_select ON public.advisory_feasibility_studies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = advisory_feasibility_studies.client_id AND c.auth_user_id = auth.uid()
  ));

-- Client can view AI advisor reports shared with them
DROP POLICY IF EXISTS ai_advisor_reports_client_select ON public.ai_advisor_reports;
CREATE POLICY ai_advisor_reports_client_select ON public.ai_advisor_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = ai_advisor_reports.client_id AND c.auth_user_id = auth.uid()
  ));

-- Client can view workflow state for their projects
DROP POLICY IF EXISTS entity_workflows_client_select ON public.entity_workflows;
CREATE POLICY entity_workflows_client_select ON public.entity_workflows FOR SELECT TO authenticated
  USING (
    entity_type = 'advisory_project'
    AND EXISTS (
      SELECT 1 FROM public.advisory_projects p
      JOIN public.advisory_clients c ON c.id = p.client_id
      WHERE p.id = entity_workflows.entity_id AND c.auth_user_id = auth.uid()
    )
  );

-- Client can view audit log entries for their project workflows
DROP POLICY IF EXISTS workflow_audit_log_client_select ON public.workflow_audit_log;
CREATE POLICY workflow_audit_log_client_select ON public.workflow_audit_log FOR SELECT TO authenticated
  USING (
    entity_type = 'advisory_project'
    AND EXISTS (
      SELECT 1 FROM public.advisory_projects p
      JOIN public.advisory_clients c ON c.id = p.client_id
      WHERE p.id = workflow_audit_log.entity_id AND c.auth_user_id = auth.uid()
    )
  );

-- Helper RPC: get current user's client id (used by portal JS to avoid extra queries)
CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.advisory_clients WHERE auth_user_id = auth.uid() LIMIT 1;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
