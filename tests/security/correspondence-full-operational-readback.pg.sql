-- Executed by a fresh psql process AFTER full-schema acceptance commits.
DO $$
DECLARE
 a uuid := '22222222-2222-4222-8222-222222222222';
 b uuid := '33333333-3333-4333-8333-333333333333';
 ua uuid := '11111111-1111-4111-8111-111111111111';
 ub uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 ca uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 cb uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
BEGIN
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
   WHERE campaign_id=ca AND workspace_id=a AND status='prepared')<>27
 THEN RAISE EXCEPTION '27 recipients lost after reconnect'; END IF;
 IF (SELECT count(DISTINCT r.draft_document_id)
   FROM public.correspondence_campaign_recipients r WHERE r.campaign_id=ca)<>27
 THEN RAISE EXCEPTION '27 independent drafts lost after reconnect'; END IF;
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients r
   JOIN public.correspondence_documents d ON d.id=r.draft_document_id
   JOIN public.correspondence_versions v ON v.document_id=d.id AND v.version=1
   WHERE r.campaign_id=ca AND r.workspace_id=a AND d.owner_user_id=ua
     AND d.created_by=ua AND d.current_version=1
     AND d.workspace_context->>'campaign_workspace_id'=a::text
     AND d.workspace_context->>'campaign_recipient_id'=r.id::text
     AND jsonb_array_length(v.pages_html)=1)<>27
 THEN RAISE EXCEPTION '27 document versions not readable after reconnect'; END IF;
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
   WHERE campaign_id=cb AND workspace_id=b)<>1
 THEN RAISE EXCEPTION 'Company B own recipient absent after reconnect'; END IF;
 IF (SELECT created_by FROM public.correspondence_campaigns WHERE id=ca) IS DISTINCT FROM ua
 OR (SELECT created_by FROM public.correspondence_campaigns WHERE id=cb) IS DISTINCT FROM ub
 THEN RAISE EXCEPTION 'Owners crossed tenant boundary'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.correspondence_campaign_recipients r
   JOIN public.correspondence_campaigns c ON c.id=r.campaign_id
   WHERE r.workspace_id IS DISTINCT FROM c.workspace_id)
 THEN RAISE EXCEPTION 'Cross-tenant recipient leaked'; END IF;
END $$;
