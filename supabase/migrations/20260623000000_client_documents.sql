-- Client document uploads for the portal
-- Stores metadata in client_documents and files in storage bucket client-documents.

-- =====================================================
-- 1. Storage bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/*',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Clients can only manage their own objects
DROP POLICY IF EXISTS client_documents_select ON storage.objects;
CREATE POLICY client_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND owner = auth.uid());

DROP POLICY IF EXISTS client_documents_insert ON storage.objects;
CREATE POLICY client_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND owner = auth.uid());

DROP POLICY IF EXISTS client_documents_delete ON storage.objects;
CREATE POLICY client_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND owner = auth.uid());

-- =====================================================
-- 2. Metadata table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.advisory_clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.advisory_projects(id) ON DELETE SET NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','analyzing','analyzed','error')),
  extracted_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_project_id ON public.client_documents(project_id);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_documents_client_select ON public.client_documents;
CREATE POLICY client_documents_client_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = client_documents.client_id AND c.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS client_documents_client_insert ON public.client_documents;
CREATE POLICY client_documents_client_insert ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = client_documents.client_id AND c.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS client_documents_client_update ON public.client_documents;
CREATE POLICY client_documents_client_update ON public.client_documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advisory_clients c
    WHERE c.id = client_documents.client_id AND c.auth_user_id = auth.uid()
  ));
