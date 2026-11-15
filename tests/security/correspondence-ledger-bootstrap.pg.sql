-- Disposable PostgreSQL 16 acceptance fixture; no real accounts or issued files.
CREATE ROLE service_role NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.correspondence_documents (
 id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'approved',
 related_document_id uuid,
 outgoing_number text,
 incoming_number text,
 reference_number text,
 verification_token uuid NOT NULL UNIQUE,
 current_version integer NOT NULL DEFAULT 1,
 document_hash text,
 issued_hash text,
 artifact_path text,
 artifact_hash text,
 artifact_document_hash text,
 artifact_issued_hash text,
 artifact_version integer,
 signature_hash text,
 stamp_hash text,
 issued_by uuid,
 issued_at timestamptz
);
CREATE TABLE public.correspondence_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.correspondence_documents(id),
 issue_version integer NOT NULL,
 issue_number text NOT NULL,
 verification_token uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'active'
   CONSTRAINT correspondence_issues_state_check
   CHECK (state in ('active','revoked','superseded')),
 document_version integer NOT NULL,
 document_hash text,
 issued_hash text NOT NULL,
 pdf_hash text,
 verification_count bigint NOT NULL DEFAULT 0,
 last_verified_at timestamptz,
 signature_hash text,
 stamp_hash text,
 issued_by uuid,
 issued_at timestamptz NOT NULL,
 supersedes_issue_id uuid REFERENCES public.correspondence_issues(id),
 UNIQUE(document_id,issue_version)
);
CREATE TABLE public.correspondence_verification_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issue_id uuid REFERENCES public.correspondence_issues(id) ON DELETE SET NULL,
 document_id uuid REFERENCES public.correspondence_documents(id) ON DELETE SET NULL,
 issue_number text,
 actor_user_id uuid,
 result text NOT NULL CHECK (result IN ('verified','failed')),
 ip_hash text,
 user_agent_hash text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.correspondence_verification_events ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT ON public.correspondence_verification_events TO service_role;
-- Historic rows are deliberately inserted BEFORE the migration.
INSERT INTO public.correspondence_documents
(id,status,verification_token,current_version,document_hash,issued_hash,artifact_path,artifact_hash,artifact_document_hash,artifact_issued_hash,artifact_version,issued_at)
VALUES
('66666666-6666-4666-8666-666666666666','issued','77777777-7777-4777-8777-777777777777',1,
'old-content','old-issue','old.pdf','old-pdf','old-content','old-issue',1,now());
INSERT INTO public.correspondence_issues
(document_id,issue_version,issue_number,verification_token,state,document_version,document_hash,issued_hash,pdf_hash,issued_at)
VALUES
('66666666-6666-4666-8666-666666666666',1,'HISTORIC-ISSUE','77777777-7777-4777-8777-777777777777',
'revoked',1,'old-content','old-issue','old-pdf',now());
