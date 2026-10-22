-- Assistant Phase 2 document intelligence ownership boundary.
-- Reuses public.client_documents and advisory_clients; no parallel document store.
-- The Assistant may read only metadata/extracted data for documents owned by the authenticated user.

CREATE OR REPLACE FUNCTION public.assistant_get_client_document(
  p_user_id uuid,
  p_document_id uuid
)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  project_id uuid,
  filename text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status text,
  extracted_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $document$
  SELECT
    d.id,
    d.client_id,
    d.project_id,
    d.filename,
    d.storage_path,
    d.mime_type,
    d.size_bytes,
    d.status,
    d.extracted_data,
    d.created_at,
    d.updated_at
  FROM public.client_documents d
  JOIN public.advisory_clients c ON c.id = d.client_id
  WHERE d.id = p_document_id
    AND c.auth_user_id = p_user_id
  LIMIT 1;
$document$;

REVOKE ALL ON FUNCTION public.assistant_get_client_document(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_get_client_document(uuid,uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
