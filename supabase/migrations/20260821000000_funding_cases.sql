-- ============================================
-- Funding Case Management — Phase 3
-- Tables: funding_cases, funding_case_events, funding_case_documents
-- Sequence: BF-YYYY-XXXXXX via bonds_sequences
-- ============================================

-- -----------------------------------------------------------------------------
-- 1. Case reference generator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_funding_case_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_seq bigint;
BEGIN
  v_year := extract(year from now())::int;
  v_seq := public.next_bonds_sequence('BF', v_year, NULL);
  RETURN 'BF-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_funding_case_reference() IS
  'Atomically allocates a human-readable funding case reference like BF-2026-000041.';

-- -----------------------------------------------------------------------------
-- 2. funding_cases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funding_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference text UNIQUE NOT NULL DEFAULT public.generate_funding_case_reference(),

  status text NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new','initial_review','documents_required','under_assessment',
      'funding_options','submitted_to_provider','provider_review',
      'approved','declined','on_hold','closed'
    )),

  source text NOT NULL DEFAULT 'direct'
    CHECK (source IN (
      'funding-hub','readiness','calculator','funding-sources','financial-advisory',
      'economic-intelligence','sector-real-estate','sector-industrial',
      'sector-hospitality','sector-healthcare','direct'
    )),

  -- Client / contact
  name text NOT NULL,
  company text NOT NULL,
  email text NOT NULL,
  phone text,
  country text,

  -- Funding details
  financing_type text,
  amount numeric(15,2),
  purpose_category text,
  purpose text,
  letter text,
  sector text,
  readiness_score int,
  estimated_payment numeric(15,2),
  duration int,

  -- Internal management
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_name text,
  provider_reference text,
  internal_notes text,

  -- Lifecycle timestamps
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  declined_at timestamptz,
  closed_at timestamptz,
  last_contact_at timestamptz,
  next_action_at timestamptz,

  -- Idempotency / duplicate protection
  idempotency_key text UNIQUE,

  -- Optional link to readiness lead
  readiness_lead_id uuid REFERENCES public.funding_readiness_leads(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.funding_cases IS 'Trackable funding requests created from /funding-extraction and related tools.';

-- -----------------------------------------------------------------------------
-- 3. funding_case_events (timeline / audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funding_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.funding_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'case_created','status_changed','assigned','note_added','contact',
      'document_requested','document_received','submitted_to_provider','case_closed'
    )),
  from_status text,
  to_status text,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.funding_case_events IS 'Timeline and audit trail for funding case lifecycle events.';

-- -----------------------------------------------------------------------------
-- 4. funding_case_documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funding_case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.funding_cases(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'funding-documents',
  storage_path text NOT NULL,
  file_size int,
  mime_type text,
  document_type text NOT NULL DEFAULT 'uploaded'
    CHECK (document_type IN ('uploaded','required','received')),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.funding_case_documents IS 'Metadata for files attached to a funding case, stored in Supabase Storage.';

-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_funding_cases_status ON public.funding_cases(status);
CREATE INDEX IF NOT EXISTS idx_funding_cases_source ON public.funding_cases(source);
CREATE INDEX IF NOT EXISTS idx_funding_cases_created_at ON public.funding_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_cases_assigned_to ON public.funding_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_funding_cases_case_reference ON public.funding_cases(case_reference);

CREATE INDEX IF NOT EXISTS idx_funding_case_events_case_id ON public.funding_case_events(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_case_documents_case_id ON public.funding_case_documents(case_id);

-- -----------------------------------------------------------------------------
-- 6. Triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_funding_cases_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_cases_updated_at ON public.funding_cases;
CREATE TRIGGER funding_cases_updated_at
  BEFORE UPDATE ON public.funding_cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_funding_cases_updated_at();

-- -----------------------------------------------------------------------------
-- 7. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.funding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_documents FORCE ROW LEVEL SECURITY;

-- Service role (serverless APIs)
DROP POLICY IF EXISTS funding_cases_service_all ON public.funding_cases;
CREATE POLICY funding_cases_service_all ON public.funding_cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS funding_case_events_service_all ON public.funding_case_events;
CREATE POLICY funding_case_events_service_all ON public.funding_case_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS funding_case_documents_service_all ON public.funding_case_documents;
CREATE POLICY funding_case_documents_service_all ON public.funding_case_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin/advisory manager access via Supabase client (defense in depth)
DROP POLICY IF EXISTS funding_cases_admin_all ON public.funding_cases;
CREATE POLICY funding_cases_admin_all ON public.funding_cases
  FOR ALL TO authenticated USING (public.is_bonds_admin()) WITH CHECK (public.is_bonds_admin());

DROP POLICY IF EXISTS funding_case_events_admin_all ON public.funding_case_events;
CREATE POLICY funding_case_events_admin_all ON public.funding_case_events
  FOR ALL TO authenticated USING (public.is_bonds_admin()) WITH CHECK (public.is_bonds_admin());

DROP POLICY IF EXISTS funding_case_documents_admin_all ON public.funding_case_documents;
CREATE POLICY funding_case_documents_admin_all ON public.funding_case_documents
  FOR ALL TO authenticated USING (public.is_bonds_admin()) WITH CHECK (public.is_bonds_admin());

-- -----------------------------------------------------------------------------
-- 8. Storage bucket for case documents
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'funding-documents',
  'funding-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: service role full access; admin read access
DROP POLICY IF EXISTS funding_documents_service_all ON storage.objects;
CREATE POLICY funding_documents_service_all ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'funding-documents') WITH CHECK (bucket_id = 'funding-documents');

DROP POLICY IF EXISTS funding_documents_admin_select ON storage.objects;
CREATE POLICY funding_documents_admin_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'funding-documents' AND public.is_bonds_admin());
