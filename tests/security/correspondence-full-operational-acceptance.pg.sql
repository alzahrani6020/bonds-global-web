-- Disposable full-schema acceptance. Uses actual correspondence_documents +
-- correspondence_versions after every original migration. Synthetic recipients
-- only. Separate psql process verifies persistence.
DO $$
DECLARE
 a uuid := '22222222-2222-4222-8222-222222222222';
 b uuid := '33333333-3333-4333-8333-333333333333';
 ua uuid := '11111111-1111-4111-8111-111111111111';
 ub uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 ca uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 cb uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 rid uuid;
 did uuid;
 i integer;
 rejected boolean;
BEGIN
 IF (SELECT owner_user_id FROM public.crm_app_workspaces WHERE id=a) IS DISTINCT FROM ua
 OR (SELECT owner_user_id FROM public.crm_app_workspaces WHERE id=b) IS DISTINCT FROM ub
 THEN RAISE EXCEPTION 'Owners are not independent'; END IF;

 INSERT INTO public.correspondence_campaigns(id,workspace_id,created_by,title,kind)
 VALUES(ca,a,ua,'Clix 27 full-schema acceptance','investment'),
       (cb,b,ub,'Company B full-schema acceptance','institutional');

 FOR i IN 1..27 LOOP
   rid:=md5('full-schema-recipient-'||i)::uuid;
   did:=md5('full-schema-document-'||i)::uuid;
   INSERT INTO public.correspondence_campaign_recipients
     (id,campaign_id,workspace_id,email,organization)
   VALUES(rid,ca,a,
     'fullschema-'||lpad(i::text,2,'0')||'@example.test',
     'Synthetic Institution '||lpad(i::text,2,'0'));
   INSERT INTO public.correspondence_documents
     (id,owner_user_id,created_by,workspace_context,status,
      title,current_version,recipient_organization,recipient_email)
   VALUES(did,ua,ua,jsonb_build_object(
     'workspace','correspondence','campaign_workspace_id',a::text,
     'campaign_recipient_id',rid::text),
     'draft','Acceptance letter '||i,1,
     'Synthetic Institution '||lpad(i::text,2,'0'),
     'fullschema-'||lpad(i::text,2,'0')||'@example.test');
   INSERT INTO public.correspondence_versions
     (document_id,version,pages_html,text_content,checksum_sha256,created_by)
   VALUES(did,1,jsonb_build_array('<p>Individual acceptance draft '||i||'</p>'),
     'Individual acceptance draft '||i,repeat('a',64),ua);
   UPDATE public.correspondence_campaign_recipients
   SET draft_document_id=did,status='prepared'
   WHERE id=rid AND workspace_id=a AND campaign_id=ca;
 END LOOP;

 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
     WHERE campaign_id=ca AND workspace_id=a AND status='prepared')<>27
 THEN RAISE EXCEPTION '27 recipients not prepared'; END IF;
 IF (SELECT count(*) FROM public.correspondence_versions v
     JOIN public.correspondence_documents d ON d.id=v.document_id
     JOIN public.correspondence_campaign_recipients r ON r.draft_document_id=d.id
     WHERE r.campaign_id=ca AND r.workspace_id=a AND v.version=1
       AND d.owner_user_id=ua AND d.created_by=ua
       AND d.workspace_context->>'campaign_recipient_id'=r.id::text)<>27
 THEN RAISE EXCEPTION '27 persisted personalized versions not proven'; END IF;

 rejected:=false;
 BEGIN
   INSERT INTO public.correspondence_campaign_recipients
     (campaign_id,workspace_id,email,organization)
   VALUES(ca,b,'cross-tenant@example.test','Forbidden');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-tenant recipient accepted'; END IF;

 INSERT INTO public.correspondence_campaign_recipients
 (campaign_id,workspace_id,email,organization)
 VALUES(cb,b,'company-b-only@example.test','Company B');
END $$;
