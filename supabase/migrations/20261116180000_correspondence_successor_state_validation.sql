-- Safe for existing issued records: changes only future trigger behavior.
-- Revoked predecessors stay revoked; pending predecessors are NOT eligible.
-- No UPDATE of historical issued content, signatures, PDF hashes, or tokens.
CREATE OR REPLACE FUNCTION public.capture_correspondence_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  previous_issue public.correspondence_issues%rowtype;
  next_version integer := 1;
BEGIN
  IF new.status <> 'issued' OR old.status = 'issued' THEN
    RETURN new;
  END IF;
  IF new.related_document_id IS NOT NULL THEN
    SELECT * INTO previous_issue
      FROM public.correspondence_issues
     WHERE document_id = new.related_document_id
     ORDER BY issue_version DESC, issued_at DESC
     LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR previous_issue.state <> 'active' OR previous_issue.pdf_hash IS NULL THEN
      RAISE EXCEPTION 'Related issue has no active finalized PDF; issuance prohibited'
        USING errcode = '23514';
    END IF;
    -- Reject a parent issue whose bound PDF is absent or inconsistent.
    IF NOT EXISTS (
      SELECT 1 FROM public.correspondence_documents parent
      WHERE parent.id = previous_issue.document_id
        AND parent.artifact_hash = previous_issue.pdf_hash
        AND parent.artifact_hash IS NOT NULL
        AND parent.status IN ('issued', 'sent', 'archived')
    ) THEN
      RAISE EXCEPTION 'Related issue artifact binding is inconsistent'
        USING errcode = '23514';
    END IF;
    next_version := previous_issue.issue_version + 1;
  END IF;
  INSERT INTO public.correspondence_issues (
    document_id, issue_version, issue_number, verification_token, state,
    document_version, document_hash, issued_hash, pdf_hash,
    signature_hash, stamp_hash, issued_by, issued_at, supersedes_issue_id
  ) VALUES (
    new.id, next_version,
    COALESCE(new.outgoing_number, new.incoming_number, new.reference_number, new.id::text),
    new.verification_token, 'pending', new.current_version,
    new.document_hash, new.issued_hash, NULL,
    new.signature_hash, new.stamp_hash, new.issued_by, new.issued_at,
    previous_issue.id
  ) ON CONFLICT (verification_token) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_correspondence_issue_after_final_pdf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  current_issue public.correspondence_issues%rowtype;
  predecessor public.correspondence_issues%rowtype;
BEGIN
  IF old.artifact_hash IS NOT NULL OR new.artifact_hash IS NULL THEN
    RETURN new;
  END IF;
  IF new.status <> 'issued'
     OR new.artifact_path IS NULL
     OR new.artifact_document_hash IS DISTINCT FROM new.document_hash
     OR new.artifact_issued_hash IS DISTINCT FROM new.issued_hash
     OR new.artifact_version IS DISTINCT FROM new.current_version THEN
    RAISE EXCEPTION 'Final PDF binding is incomplete or inconsistent'
      USING errcode = '23514';
  END IF;

  SELECT * INTO current_issue
    FROM public.correspondence_issues
   WHERE document_id = new.id AND verification_token = new.verification_token
   FOR UPDATE;
  IF NOT FOUND OR current_issue.state <> 'pending'
     OR current_issue.document_hash IS DISTINCT FROM new.document_hash
     OR current_issue.issued_hash IS DISTINCT FROM new.issued_hash
     OR current_issue.document_version IS DISTINCT FROM new.current_version THEN
    RAISE EXCEPTION 'Pending issue not eligible for PDF activation'
      USING errcode = '23514';
  END IF;

  -- Lock predecessor before final activation to serialize competing successors.
  IF current_issue.supersedes_issue_id IS NOT NULL THEN
    SELECT * INTO predecessor
      FROM public.correspondence_issues
     WHERE id = current_issue.supersedes_issue_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Predecessor issue missing' USING errcode = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.correspondence_issues contender
      WHERE contender.supersedes_issue_id = predecessor.id
        AND contender.id <> current_issue.id AND contender.state = 'active'
    ) THEN
      RAISE EXCEPTION 'A competing successor is already active'
        USING errcode = '23514';
    END IF;
    IF predecessor.state = 'active' AND predecessor.pdf_hash IS NOT NULL THEN
      UPDATE public.correspondence_issues
         SET state = 'superseded'
       WHERE id = predecessor.id
         AND state = 'active' AND pdf_hash IS NOT NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Active predecessor changed during PDF activation'
          USING errcode = '23514';
      END IF;
    ELSIF predecessor.state = 'revoked' THEN
      -- Historical revoked records remain immutable. A previously issued,
      -- pending successor may become active without reviving/replacing them.
      -- New invalid links are prevented by capture_correspondence_issue().
      NULL;
    ELSE
      RAISE EXCEPTION 'Predecessor is still pending or superseded'
        USING errcode = '23514';
    END IF;
  END IF;

  UPDATE public.correspondence_issues
     SET pdf_hash = new.artifact_hash, state = 'active'
   WHERE id = current_issue.id AND state = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue activation lost race' USING errcode = '23514';
  END IF;
  RETURN new;
END;
$function$;
