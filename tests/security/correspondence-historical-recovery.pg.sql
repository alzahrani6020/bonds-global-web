-- Disposable PostgreSQL acceptance only. Never run against production.
-- A historic revoked predecessor is NEVER rewritten to active/superseded.
INSERT INTO public.correspondence_documents
(id,status,related_document_id,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES
('88888888-8888-4888-8888-888888888888','issued','66666666-6666-4666-8666-666666666666',
 '88888888-aaaa-4888-8888-888888888888',1,'historic-child-content','historic-child-issued','HISTORIC-RECOVERY',now());

INSERT INTO public.correspondence_issues
(document_id,issue_version,issue_number,verification_token,state,document_version,document_hash,issued_hash,issued_at,supersedes_issue_id)
VALUES
('88888888-8888-4888-8888-888888888888',2,'HISTORIC-RECOVERY',
 '88888888-aaaa-4888-8888-888888888888','pending',1,'historic-child-content','historic-child-issued',now(),
 (SELECT id FROM public.correspondence_issues WHERE issue_number='HISTORIC-ISSUE'));

UPDATE public.correspondence_documents
SET artifact_path='historic-recovery.pdf',artifact_hash='recovery-pdf',
    artifact_document_hash='historic-child-content',artifact_issued_hash='historic-child-issued',artifact_version=1
WHERE id='88888888-8888-4888-8888-888888888888';

DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='HISTORIC-RECOVERY') <> 'active'
  OR (SELECT pdf_hash FROM public.correspondence_issues WHERE issue_number='HISTORIC-RECOVERY') <> 'recovery-pdf'
  OR (SELECT state FROM public.correspondence_issues WHERE issue_number='HISTORIC-ISSUE') <> 'revoked'
  OR (SELECT pdf_hash FROM public.correspondence_issues WHERE issue_number='HISTORIC-ISSUE') <> 'old-pdf'
 THEN RAISE EXCEPTION 'recovery changed revoked predecessor or did not activate successor'; END IF;
END $$;

-- No new issued record may link to a revoked predecessor. This denial must
-- roll back the status transition, without consuming a new issue row.
INSERT INTO public.correspondence_documents
(id,status,related_document_id,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES ('99999999-9999-4999-8999-999999999999','approved','66666666-6666-4666-8666-666666666666',
 '99999999-aaaa-4999-8999-999999999999',1,'illegal-content','illegal-issued','BLOCK-REVOKED',now());
DO $$
BEGIN
 BEGIN
  UPDATE public.correspondence_documents SET status='issued'
   WHERE id='99999999-9999-4999-8999-999999999999';
  RAISE EXCEPTION 'revoked predecessor was accepted for new issuance';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT status FROM public.correspondence_documents
     WHERE id='99999999-9999-4999-8999-999999999999') <> 'approved'
   OR EXISTS(SELECT 1 FROM public.correspondence_issues WHERE issue_number='BLOCK-REVOKED')
 THEN RAISE EXCEPTION 'blocked issuance left partial document mutation'; END IF;
END $$;

-- A successor whose historical predecessor remains pending cannot activate.
INSERT INTO public.correspondence_documents
(id,status,related_document_id,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','issued','55555555-5555-4555-8555-555555555555',
 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa',1,'pending-child','pending-issue','BLOCK-PENDING',now());
INSERT INTO public.correspondence_issues
(document_id,issue_version,issue_number,verification_token,state,document_version,document_hash,issued_hash,issued_at,supersedes_issue_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,'BLOCK-PENDING',
 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa','pending',1,'pending-child','pending-issue',now(),
 (SELECT id FROM public.correspondence_issues WHERE issue_number='CHILD-B'));
DO $$
BEGIN
 BEGIN
  UPDATE public.correspondence_documents SET artifact_path='should-not-persist.pdf',
   artifact_hash='rejected-pdf',artifact_document_hash='pending-child',
   artifact_issued_hash='pending-issue',artifact_version=1
   WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'pending predecessor was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT artifact_hash FROM public.correspondence_documents
     WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS NOT NULL
  OR (SELECT state FROM public.correspondence_issues WHERE issue_number='BLOCK-PENDING') <> 'pending'
 THEN RAISE EXCEPTION 'pending predecessor rejection was not atomic'; END IF;
END $$;
SELECT 'PASS: revoked historical predecessor immutable; recoverable pending successor; new invalid links rejected; pending predecessor cannot activate' AS acceptance;
