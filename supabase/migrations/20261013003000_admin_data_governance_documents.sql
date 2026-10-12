-- Data Governance and Document Center.

CREATE TABLE IF NOT EXISTS public.admin_data_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_or_field text NOT NULL,
  source_table text NOT NULL,
  source_column text,
  transformation text,
  destination text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  classification text NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','confidential','restricted')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_data_lineage_unique
  ON public.admin_data_lineage(metric_or_field,source_table,coalesce(source_column,''));

CREATE TABLE IF NOT EXISTS public.admin_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category text NOT NULL UNIQUE,
  retention_days integer NOT NULL CHECK (retention_days >= 0),
  legal_basis text,
  deletion_mode text NOT NULL DEFAULT 'review' CHECK (deletion_mode IN ('review','anonymize','delete','archive')),
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_pii_field_policies (
  field_key text PRIMARY KEY,
  classification text NOT NULL DEFAULT 'confidential' CHECK (classification IN ('public','internal','confidential','restricted')),
  mask_strategy text NOT NULL DEFAULT 'partial' CHECK (mask_strategy IN ('none','partial','full','hash')),
  required_permission text NOT NULL DEFAULT 'users.read_sensitive',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_pii_field_policies(field_key,classification,mask_strategy,required_permission) VALUES
('profiles.email','confidential','partial','users.read_sensitive'),
('profiles.phone','confidential','partial','users.read_sensitive'),
('profiles.tax_number','restricted','full','users.read_sensitive'),
('security.ip_address','restricted','partial','security.read')
ON CONFLICT(field_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','export','rectification','deletion','restriction')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','verifying','approved','processing','completed','rejected','cancelled')),
  identity_verified boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  completed_at timestamptz,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  evidence jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON public.admin_privacy_requests(status,due_at);

CREATE TABLE IF NOT EXISTS public.admin_data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_type text NOT NULL,
  fields text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}',
  row_count integer,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','running','completed','failed','expired','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  artifact_reference text,
  expires_at timestamptz,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_data_exports_status ON public.admin_data_exports(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_user_merge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','executing','completed','failed','cancelled')),
  dry_run jsonb NOT NULL DEFAULT '{}',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(source_user_id <> target_user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_integrity_anchors (
  id bigserial PRIMARY KEY,
  range_start timestamptz NOT NULL,
  range_end timestamptz NOT NULL,
  row_count integer NOT NULL,
  digest_sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.admin_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('user','organization','advisory_client','funding_case','contract','support_ticket')),
  entity_id text NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','superseded','archived','rejected')),
  classification text NOT NULL DEFAULT 'confidential' CHECK (classification IN ('public','internal','confidential','restricted')),
  storage_provider text NOT NULL DEFAULT 'supabase',
  storage_path text,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  expires_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_documents_entity ON public.admin_documents(entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_documents_expiry ON public.admin_documents(expires_at);

CREATE TABLE IF NOT EXISTS public.admin_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.admin_documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id,version)
);

CREATE TABLE IF NOT EXISTS public.admin_document_permissions (
  document_id uuid NOT NULL REFERENCES public.admin_documents(id) ON DELETE CASCADE,
  role text NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  can_verify boolean NOT NULL DEFAULT false,
  PRIMARY KEY(document_id,role)
);

ALTER TABLE public.admin_data_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_pii_field_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_merge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_integrity_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_document_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_data_lineage,public.admin_retention_policies,public.admin_pii_field_policies,public.admin_privacy_requests,public.admin_data_exports,public.admin_user_merge_requests,public.admin_audit_integrity_anchors,public.admin_documents,public.admin_document_versions,public.admin_document_permissions FROM anon,authenticated;

INSERT INTO public.admin_permissions(permission,description,risk_level) VALUES
('users.read_sensitive','Read unmasked customer PII','high'),
('governance.read','Read data governance controls','high'),
('governance.manage','Manage privacy retention and lineage','critical'),
('documents.read','Read managed documents','high'),
('documents.manage','Manage document metadata and versions','high')
ON CONFLICT(permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role,permission)
SELECT role,permission FROM (VALUES
('super_admin','users.read_sensitive'),('super_admin','governance.read'),('super_admin','governance.manage'),('super_admin','documents.read'),('super_admin','documents.manage'),
('admin','governance.read'),('admin','documents.read'),('admin','documents.manage')
) AS x(role,permission) ON CONFLICT(role,permission) DO NOTHING;
