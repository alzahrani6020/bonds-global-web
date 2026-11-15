-- Isolated full trigger acceptance against the EXACT proposed migration.
CREATE TRIGGER trg_capture_correspondence_issue
AFTER UPDATE OF status ON public.correspondence_documents
FOR EACH ROW
WHEN (new.status = 'issued' AND old.status IS DISTINCT FROM new.status)
EXECUTE FUNCTION public.capture_correspondence_issue();

DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='HISTORIC-ISSUE') <> 'revoked'
    OR (SELECT pdf_hash FROM public.correspondence_issues WHERE issue_number='HISTORIC-ISSUE') <> 'old-pdf'
 THEN RAISE EXCEPTION 'historical issued record was modified'; END IF;
END $$;

INSERT INTO public.correspondence_documents
(id,status,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES
('11111111-1111-4111-8111-111111111111','approved','11111111-aaaa-4111-8111-111111111111',1,'d1','i1','ROOT',now());
UPDATE public.correspondence_documents SET status='issued'
WHERE id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'pending'
 THEN RAISE EXCEPTION 'initial issue should remain pending without finalized PDF'; END IF;
END $$;
UPDATE public.correspondence_documents SET
 artifact_hash='p1',artifact_path='root.pdf',artifact_document_hash='d1',artifact_issued_hash='i1',artifact_version=1
WHERE id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'active'
 OR (SELECT pdf_hash FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'p1'
 THEN RAISE EXCEPTION 'initial finalized issue did not activate'; END IF;
END $$;

INSERT INTO public.correspondence_documents
(id,status,related_document_id,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES
('33333333-3333-4333-8333-333333333333','approved','11111111-1111-4111-8111-111111111111',
'33333333-aaaa-4333-8333-333333333333',1,'d3','i3','SUCCESSOR',now());
UPDATE public.correspondence_documents SET status='issued'
WHERE id='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'active'
 OR (SELECT state FROM public.correspondence_issues WHERE issue_number='SUCCESSOR') <> 'pending'
 THEN RAISE EXCEPTION 'predecessor replaced before successor PDF finalized'; END IF;
END $$;
DO $$
BEGIN
 BEGIN
  UPDATE public.correspondence_documents SET
    artifact_hash='bad-pdf',artifact_path='bad.pdf',artifact_document_hash='wrong',
    artifact_issued_hash='i3',artifact_version=1
  WHERE id='33333333-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'invalid PDF binding incorrectly accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT artifact_hash FROM public.correspondence_documents WHERE id='33333333-3333-4333-8333-333333333333') IS NOT NULL
 OR (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'active'
 THEN RAISE EXCEPTION 'invalid PDF binding did not roll back'; END IF;
END $$;
UPDATE public.correspondence_documents SET
 artifact_hash='p3',artifact_path='successor.pdf',artifact_document_hash='d3',
 artifact_issued_hash='i3',artifact_version=1
WHERE id='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT') <> 'superseded'
 OR (SELECT state FROM public.correspondence_issues WHERE issue_number='SUCCESSOR') <> 'active'
 OR (SELECT pdf_hash FROM public.correspondence_issues WHERE issue_number='SUCCESSOR') <> 'p3'
 THEN RAISE EXCEPTION 'successor activation and predecessor supersession were not atomic'; END IF;
END $$;

-- A second valid chain tests two competing successors to the same predecessor.
INSERT INTO public.correspondence_documents
(id,status,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES ('22222222-2222-4222-8222-222222222222','approved',
'22222222-aaaa-4222-8222-222222222222',1,'d2','i2','ROOT2',now());
UPDATE public.correspondence_documents SET status='issued'
WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.correspondence_documents SET
 artifact_hash='p2',artifact_path='root2.pdf',artifact_document_hash='d2',artifact_issued_hash='i2',artifact_version=1
WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.correspondence_documents
(id,status,related_document_id,verification_token,current_version,document_hash,issued_hash,outgoing_number,issued_at)
VALUES
('44444444-4444-4444-8444-444444444444','approved','22222222-2222-4222-8222-222222222222',
'44444444-aaaa-4444-8444-444444444444',1,'d4','i4','CHILD-A',now()),
('55555555-5555-4555-8555-555555555555','approved','22222222-2222-4222-8222-222222222222',
'55555555-aaaa-4555-8555-555555555555',1,'d5','i5','CHILD-B',now());
UPDATE public.correspondence_documents SET status='issued'
WHERE id IN ('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555');
UPDATE public.correspondence_documents SET
 artifact_hash='p4',artifact_path='a.pdf',artifact_document_hash='d4',artifact_issued_hash='i4',artifact_version=1
WHERE id='44444444-4444-4444-8444-444444444444';
DO $$
BEGIN
 BEGIN
  UPDATE public.correspondence_documents SET
   artifact_hash='p5',artifact_path='b.pdf',artifact_document_hash='d5',artifact_issued_hash='i5',artifact_version=1
  WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'competing successor incorrectly accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT state FROM public.correspondence_issues WHERE issue_number='ROOT2') <> 'superseded'
 OR (SELECT state FROM public.correspondence_issues WHERE issue_number='CHILD-A') <> 'active'
 OR (SELECT state FROM public.correspondence_issues WHERE issue_number='CHILD-B') <> 'pending'
 OR (SELECT artifact_hash FROM public.correspondence_documents WHERE id='55555555-5555-4555-8555-555555555555') IS NOT NULL
 THEN RAISE EXCEPTION 'competing activation corrupted predecessor or issued documents'; END IF;
END $$;

SELECT 'PASS: atomic successor activation, failed PDF rollback, historical immutability, competing successors' AS acceptance;
