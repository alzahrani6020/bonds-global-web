-- ============================================
-- Funding Case Management — Phase 4
-- Operationalization: advisory link, workflow, notifications, SLA
-- ============================================

-- -----------------------------------------------------------------------------
-- 1. Link funding cases to advisory clients/projects + SLA tracking
-- -----------------------------------------------------------------------------
ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.advisory_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_funding_cases_client_id ON public.funding_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_funding_cases_project_id ON public.funding_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_cases_next_action_at ON public.funding_cases(next_action_at);
CREATE INDEX IF NOT EXISTS idx_funding_cases_sla_deadline_at ON public.funding_cases(sla_deadline_at);

COMMENT ON COLUMN public.funding_cases.client_id IS 'Linked advisory client (optional).';
COMMENT ON COLUMN public.funding_cases.project_id IS 'Linked advisory project (optional).';
COMMENT ON COLUMN public.funding_cases.sla_deadline_at IS 'Deadline used for SLA / escalation tracking.';

-- -----------------------------------------------------------------------------
-- 2. Workflow state-machine table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funding_case_allowed_transitions (
  from_status text NOT NULL,
  to_status text NOT NULL,
  requires_note boolean DEFAULT false,
  requires_document boolean DEFAULT false,
  PRIMARY KEY (from_status, to_status)
);

COMMENT ON TABLE public.funding_case_allowed_transitions IS 'Allowed funding case status transitions and gate requirements.';

INSERT INTO public.funding_case_allowed_transitions (from_status, to_status, requires_note, requires_document) VALUES
  ('new','initial_review',false,false),
  ('initial_review','documents_required',false,false),
  ('documents_required','under_assessment',false,false),
  ('under_assessment','funding_options',false,false),
  ('funding_options','submitted_to_provider',false,false),
  ('submitted_to_provider','provider_review',false,false),
  ('provider_review','approved',false,false),
  ('provider_review','declined',true,false),
  ('approved','closed',false,false),
  ('declined','closed',false,false),
  ('on_hold','initial_review',false,false),
  ('initial_review','on_hold',false,false),
  ('documents_required','on_hold',false,false),
  ('under_assessment','on_hold',false,false),
  ('funding_options','on_hold',false,false),
  ('submitted_to_provider','on_hold',false,false),
  ('provider_review','on_hold',false,false)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Notification templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  subject_ar text NOT NULL,
  subject_en text,
  body_ar text NOT NULL,
  body_en text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','push','sms')),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.notification_templates IS 'Reusable notification templates for funding cases and other modules.';

INSERT INTO public.notification_templates (key, subject_ar, body_ar, channel) VALUES
('funding_status_changed',
 'تحديث حالة طلب التمويل {{case_reference}}',
 'مرحباً {{name}}،<br>تم تحديث حالة طلب التمويل <strong>{{case_reference}}</strong> إلى: <strong>{{status_label}}</strong>.<br>لمزيد من التفاصيل يمكنك الرد على هذا البريد أو التواصل عبر الواتساب.',
 'email'),
('funding_document_requested',
 'مطلوب مستندات إضافية — طلب {{case_reference}}',
 'مرحباً {{name}}،<br>نحتاج إلى المستندات التالية لإكمال تقييم طلب التمويل <strong>{{case_reference}}</strong>:<br>{{documents}}<br>يرجى الرد مباشرة على هذا البريد أو إرسالها عبر الواتساب.',
 'email'),
('funding_reminder',
 'تذكير بمتابعة طلب التمويل {{case_reference}}',
 'مرحباً {{name}}،<br>نذكرك بأن موعد المتابعة لطلب التمويل <strong>{{case_reference}}</strong> هو <strong>{{next_action_at}}</strong>.<br>نتطلع للتواصل معك.',
 'email')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Extend funding_case_events for notification tracking
-- -----------------------------------------------------------------------------
ALTER TABLE public.funding_case_events
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_funding_case_events_template_key ON public.funding_case_events(template_key);
CREATE INDEX IF NOT EXISTS idx_funding_case_events_notification_sent ON public.funding_case_events(notification_sent);

-- -----------------------------------------------------------------------------
-- 5. Fix advisory client status to allow 'lead' (used by capture_lead)
-- -----------------------------------------------------------------------------
ALTER TABLE public.advisory_clients
  DROP CONSTRAINT IF EXISTS advisory_clients_status_check,
  ADD CONSTRAINT advisory_clients_status_check
    CHECK (status IN ('lead','active','inactive','archived'));

-- -----------------------------------------------------------------------------
-- 6. Helper to create an advisory project from a funding case
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_advisory_project_from_funding_case(
  p_client_id uuid,
  p_case_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_case public.funding_cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM public.funding_cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Funding case not found';
  END IF;

  INSERT INTO public.advisory_projects (
    client_id,
    name,
    description,
    status,
    budget,
    assigned_to,
    created_by
  ) VALUES (
    p_client_id,
    COALESCE(p_name, 'مشروع تمويل ' || v_case.case_reference),
    COALESCE(p_description, v_case.purpose),
    'lead',
    v_case.amount,
    v_case.assigned_to,
    p_created_by
  )
  RETURNING id INTO v_project_id;

  UPDATE public.funding_cases
  SET project_id = v_project_id,
      updated_at = now()
  WHERE id = p_case_id;

  RETURN v_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_advisory_project_from_funding_case(uuid, uuid, text, text, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Allow advisors/viewers to read funding cases through RLS (defense in depth)
--     Manager already has access via is_bonds_admin.  Advisors and viewers
--     access through the service_role API, but we keep a permissive SELECT
--     policy for authenticated advisory users for future client-side queries.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_funding_case_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advisory_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS funding_cases_advisory_select ON public.funding_cases;
CREATE POLICY funding_cases_advisory_select ON public.funding_cases
  FOR SELECT TO authenticated USING (public.is_funding_case_user());

DROP POLICY IF EXISTS funding_case_events_advisory_select ON public.funding_case_events;
CREATE POLICY funding_case_events_advisory_select ON public.funding_case_events
  FOR SELECT TO authenticated USING (public.is_funding_case_user());

DROP POLICY IF EXISTS funding_case_documents_advisory_select ON public.funding_case_documents;
CREATE POLICY funding_case_documents_advisory_select ON public.funding_case_documents
  FOR SELECT TO authenticated USING (public.is_funding_case_user());

DROP POLICY IF EXISTS funding_documents_advisory_select ON storage.objects;
CREATE POLICY funding_documents_advisory_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'funding-documents' AND public.is_funding_case_user());
