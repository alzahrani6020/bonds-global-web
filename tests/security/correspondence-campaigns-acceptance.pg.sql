-- Fail immediately if any campaign isolation or persistence invariant is violated.
DO $$
DECLARE a uuid='22222222-2222-4222-8222-222222222222'; b uuid='33333333-3333-4333-8333-333333333333';
  u uuid='11111111-1111-4111-8111-111111111111';
  c uuid='55555555-5555-4555-8555-555555555555';
  r uuid='66666666-6666-4666-8666-666666666666';
  rejected boolean;
BEGIN
 IF (SELECT count(*) FROM public.correspondence_documents WHERE id='44444444-4444-4444-8444-444444444444') <> 1 THEN
   RAISE EXCEPTION 'Existing official correspondence was altered';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace
  WHERE n.nspname='public' AND x.relname IN
  ('correspondence_campaigns','correspondence_campaign_recipients','correspondence_campaign_events')
  AND NOT x.relrowsecurity
 ) THEN RAISE EXCEPTION 'RLS not enabled on campaign tables'; END IF;
 IF has_table_privilege('anon','public.correspondence_campaigns','SELECT') OR
  has_table_privilege('authenticated','public.correspondence_campaigns','SELECT') OR
  has_table_privilege('anon','public.correspondence_campaign_recipients','SELECT') OR
  has_table_privilege('authenticated','public.correspondence_campaign_recipients','SELECT')
 THEN RAISE EXCEPTION 'Campaign table exposed to browser roles'; END IF;
 INSERT INTO public.correspondence_campaigns(id,workspace_id,created_by,title,kind)
 VALUES(c,a,u,'Clix investor campaign','investment');
 INSERT INTO public.correspondence_campaign_recipients(id,campaign_id,workspace_id,email,organization)
 VALUES(r,c,a,'investor@example.com','Investor');
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients WHERE campaign_id=c)<>1
 THEN RAISE EXCEPTION 'Campaign recipient not persisted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,workspace_id,email,organization)
  VALUES(c,b,'cross@example.com','Cross tenant');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-company campaign recipient accepted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,workspace_id,email,organization)
  VALUES(c,a,'INVESTOR@example.com','Duplicate');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate campaign recipient accepted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,workspace_id,email,organization,document_id)
  VALUES(c,a,'other@example.com','Other','44444444-4444-4444-8444-444444444444');
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,workspace_id,email,organization,document_id)
  VALUES(c,a,'second@example.com','Second','44444444-4444-4444-8444-444444444444');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Official document reused across two recipients'; END IF;
END $$;

DO $$
DECLARE a uuid='22222222-2222-4222-8222-222222222222'; b uuid='33333333-3333-4333-8333-333333333333';
 u uuid='11111111-1111-4111-8111-111111111111';
 c uuid='55555555-5555-4555-8555-555555555555';
 r uuid='66666666-6666-4666-8666-666666666666';
 m uuid='77777777-7777-4777-8777-777777777777';
 rejected boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace
  WHERE n.nspname='public' AND x.relname IN
  ('correspondence_mailboxes','correspondence_mailbox_oauth_states','correspondence_campaign_dispatch_jobs')
  AND NOT x.relrowsecurity) THEN RAISE EXCEPTION 'Mailbox/queue RLS missing'; END IF;
 IF has_table_privilege('anon','public.correspondence_mailboxes','SELECT') OR
  has_table_privilege('authenticated','public.correspondence_mailboxes','SELECT') OR
  has_table_privilege('anon','public.correspondence_campaign_dispatch_jobs','SELECT')
 THEN RAISE EXCEPTION 'Secrets/queue accessible to browser role'; END IF;
 INSERT INTO public.correspondence_mailboxes(id,workspace_id,address,account_id,region,encrypted_refresh_token,connected_by)
 VALUES(m,a,'info@bonds-global.com','123456789','com','encrypted-test-only',u);
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_mailboxes(workspace_id,address,account_id,region,encrypted_refresh_token,connected_by)
  VALUES(b,'INFO@BONDS-GLOBAL.COM','987654321','com','encrypted-test-only',u);
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Sender identity shared by two tenants'; END IF;
 INSERT INTO public.correspondence_campaign_dispatch_jobs
 (campaign_id,workspace_id,recipient_id,document_id,mailbox_id,issued_hash,idempotency_key)
 VALUES(c,a,r,'44444444-4444-4444-8444-444444444444',m,repeat('a',64),repeat('b',64));
 IF (SELECT count(*) FROM public.correspondence_campaign_dispatch_jobs WHERE campaign_id=c)<>1
 THEN RAISE EXCEPTION 'Dispatch job not persisted'; END IF;
 INSERT INTO public.correspondence_documents(id,owner_user_id,workspace_context,status)
 VALUES('88888888-8888-4888-8888-888888888888',u,jsonb_build_object('campaign_workspace_id',a::text),'issued');
 INSERT INTO public.correspondence_campaign_recipients(id,campaign_id,workspace_id,email,organization)
 VALUES('99999999-9999-4999-8999-999999999999',c,a,'separate@example.com','Separate');
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_dispatch_jobs
  (campaign_id,workspace_id,recipient_id,document_id,mailbox_id,issued_hash,idempotency_key)
  VALUES(c,b,'99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',m,repeat('a',64),repeat('c',64));
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-tenant dispatch job accepted'; END IF;
END $$;

DO $$
DECLARE u uuid='11111111-1111-4111-8111-111111111111'; 
 a uuid='22222222-2222-4222-8222-222222222222';
 r uuid='66666666-6666-4666-8666-666666666666';
 rejected boolean:=false;
BEGIN
 INSERT INTO public.correspondence_documents(id,owner_user_id,workspace_context,status)
 VALUES('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',u,
  jsonb_build_object('campaign_workspace_id',a::text,'campaign_recipient_id',r::text),'draft');
 BEGIN
  INSERT INTO public.correspondence_documents(id,owner_user_id,workspace_context,status)
  VALUES('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa',u,
   jsonb_build_object('campaign_workspace_id',a::text,'campaign_recipient_id',r::text),'draft');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Multiple personalized drafts created for same campaign recipient'; END IF;
END $$;


-- Operational persistence fixture: 27 separate tenant-A recipients and draft
-- documents, plus a genuine second tenant owner. Synthetic IDs and addresses
-- only; never copy the confidential Clix contact list into CI logs or Git.
DO $$
DECLARE
 a uuid='22222222-2222-4222-8222-222222222222';
 b uuid='33333333-3333-4333-8333-333333333333';
 ua uuid='11111111-1111-4111-8111-111111111111';
 ub uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 ca uuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 cb uuid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 rid uuid;
 did uuid;
 i integer;
BEGIN
 IF (SELECT owner_user_id FROM public.crm_app_workspaces WHERE id=a) IS DISTINCT FROM ua
    OR (SELECT owner_user_id FROM public.crm_app_workspaces WHERE id=b) IS DISTINCT FROM ub
    OR ua=ub THEN
   RAISE EXCEPTION 'Companies are not controlled by two independent identities';
 END IF;

 INSERT INTO public.correspondence_campaigns
 (id,workspace_id,created_by,title,kind,subject_template,body_template)
 VALUES
 (ca,a,ua,'Clix 27-recipient acceptance','investment',
  'Institutional correspondence {{organization}}','An individual reviewed letter'),
 (cb,b,ub,'Separate company acceptance','institutional',
  'Company B internal','Separate tenant');

 FOR i IN 1..27 LOOP
   rid:=md5('clix-acceptance-recipient-'||i)::uuid;
   did:=md5('clix-acceptance-draft-'||i)::uuid;
   INSERT INTO public.correspondence_campaign_recipients
   (id,campaign_id,workspace_id,email,organization,status)
   VALUES(rid,ca,a,
    'acceptance-'||lpad(i::text,2,'0')||'@example.test',
    'Synthetic Institution '||lpad(i::text,2,'0'),'pending');
   INSERT INTO public.correspondence_documents
   (id,owner_user_id,workspace_context,status)
   VALUES(did,ua,jsonb_build_object(
    'workspace','correspondence',
    'campaign_workspace_id',a::text,
    'campaign_recipient_id',rid::text),'draft');
   UPDATE public.correspondence_campaign_recipients
   SET draft_document_id=did,status='prepared'
   WHERE id=rid AND campaign_id=ca AND workspace_id=a;
 END LOOP;

 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
     WHERE campaign_id=ca AND workspace_id=a AND status='prepared'
     AND draft_document_id IS NOT NULL) <> 27 THEN
   RAISE EXCEPTION '27 draft bindings not persisted';
 END IF;
 IF (SELECT count(DISTINCT draft_document_id)
     FROM public.correspondence_campaign_recipients WHERE campaign_id=ca) <> 27 THEN
   RAISE EXCEPTION 'Individual draft identifiers are not unique';
 END IF;
 IF (SELECT count(*) FROM public.correspondence_documents d
     JOIN public.correspondence_campaign_recipients r
       ON r.draft_document_id=d.id
     WHERE r.campaign_id=ca AND r.workspace_id=a
       AND d.owner_user_id=ua
       AND d.workspace_context->>'campaign_workspace_id'=a::text
       AND d.workspace_context->>'campaign_recipient_id'=r.id::text) <> 27 THEN
   RAISE EXCEPTION '27 draft-to-recipient tenant bindings invalid';
 END IF;
 IF EXISTS(SELECT 1 FROM public.correspondence_campaign_recipients
      WHERE campaign_id=ca AND workspace_id<>a)
   OR EXISTS(SELECT 1 FROM public.correspondence_campaign_recipients
      WHERE campaign_id=cb) THEN
   RAISE EXCEPTION 'Cross-tenant campaign recipients leaked';
 END IF;

 -- A second company may independently create correspondence, but cannot
 -- attach a recipient from A to its campaign due to the composite FK.
 INSERT INTO public.correspondence_campaign_recipients
 (campaign_id,workspace_id,email,organization)
 VALUES(cb,b,'separate-company@example.test','Company B Only');
BEGIN
 INSERT INTO public.correspondence_campaign_recipients
 (campaign_id,workspace_id,email,organization)
 VALUES(ca,b,'cross-tenant@example.test','Forbidden');
 RAISE EXCEPTION 'Cross-tenant recipient unexpectedly accepted';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END;

END $$;
