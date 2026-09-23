-- ============================================
-- Funding Case Management — Client Portal Add-on
-- Adds user_id link, guest access tokens, and client RLS policies.
-- ============================================

-- -----------------------------------------------------------------------------
-- 1. Link funding cases to authenticated users
-- -----------------------------------------------------------------------------
ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_token_hash text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz;

COMMENT ON COLUMN public.funding_cases.user_id IS 'Authenticated user who owns the case (NULL for anonymous submissions).';
COMMENT ON COLUMN public.funding_cases.access_token_hash IS 'Optional hash of a short-lived guest access token (claim-by-reference).';
COMMENT ON COLUMN public.funding_cases.access_token_expires_at IS 'Expiry timestamp for the guest access token.';

CREATE INDEX IF NOT EXISTS idx_funding_cases_user_id ON public.funding_cases(user_id);

-- -----------------------------------------------------------------------------
-- 2. Client SELECT policies (own cases only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS funding_cases_client_select ON public.funding_cases;
CREATE POLICY funding_cases_client_select ON public.funding_cases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS funding_case_events_client_select ON public.funding_case_events;
CREATE POLICY funding_case_events_client_select ON public.funding_case_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funding_cases c
    WHERE c.id = funding_case_events.case_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS funding_case_documents_client_select ON public.funding_case_documents;
CREATE POLICY funding_case_documents_client_select ON public.funding_case_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funding_cases c
    WHERE c.id = funding_case_documents.case_id AND c.user_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- 3. Storage policy for client uploads
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS funding_documents_client_insert ON storage.objects;
CREATE POLICY funding_documents_client_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'funding-documents'
    AND (storage.foldername(name))[1] = 'client-uploads'
    AND EXISTS (
      SELECT 1 FROM public.funding_cases c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Update notification templates to include the client portal link
-- -----------------------------------------------------------------------------
INSERT INTO public.notification_templates (key, subject_ar, subject_en, body_ar, body_en, channel) VALUES
('funding_status_changed',
 'تحديث حالة طلب التمويل {{case_reference}}',
 'Funding case update — {{case_reference}}',
 'مرحباً {{name}}،<br>تم تحديث حالة طلب التمويل <strong>{{case_reference}}</strong> إلى: <strong>{{status_label}}</strong>.<br>يمكنك متابعة تفاصيل طلبك ورفع المستندات من خلال <a href="{{portal_link}}">بوابة العميل</a>.<br>لمزيد من التفاصيل يمكنك الرد على هذا البريد أو التواصل عبر الواتساب.',
 'Hello {{name}},<br>Your funding case <strong>{{case_reference}}</strong> has been updated to: <strong>{{status_label}}</strong>.<br>You can view details and upload documents via the <a href="{{portal_link}}">client portal</a>.<br>Reply to this email or contact us on WhatsApp for more details.',
 'email'),
('funding_document_requested',
 'مطلوب مستندات إضافية — طلب {{case_reference}}',
 'Documents required — {{case_reference}}',
 'مرحباً {{name}}،<br>نحتاج إلى المستندات التالية لإكمال تقييم طلب التمويل <strong>{{case_reference}}</strong>:<br>{{documents}}<br>يرجى رفعها مباشرة من خلال <a href="{{portal_link}}">بوابة العميل</a> أو الرد على هذا البريد.',
 'Hello {{name}},<br>We need the following documents to complete the assessment of your funding case <strong>{{case_reference}}</strong>:<br>{{documents}}<br>Please upload them via the <a href="{{portal_link}}">client portal</a> or reply to this email.',
 'email'),
('funding_reminder',
 'تذكير بمتابعة طلب التمويل {{case_reference}}',
 'Reminder — funding case {{case_reference}}',
 'مرحباً {{name}}،<br>نذكرك بأن موعد المتابعة لطلب التمويل <strong>{{case_reference}}</strong> هو <strong>{{next_action_at}}</strong>.<br>يمكنك مراجعة الحالة من خلال <a href="{{portal_link}}">بوابة العميل</a>.',
 'Hello {{name}},<br>This is a reminder that the follow-up date for your funding case <strong>{{case_reference}}</strong> is <strong>{{next_action_at}}</strong>.<br>You can review the status via the <a href="{{portal_link}}">client portal</a>.',
 'email')
ON CONFLICT (key) DO UPDATE SET
  subject_ar = EXCLUDED.subject_ar,
  subject_en = EXCLUDED.subject_en,
  body_ar = EXCLUDED.body_ar,
  body_en = EXCLUDED.body_en,
  channel = EXCLUDED.channel;
