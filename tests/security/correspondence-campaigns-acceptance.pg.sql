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
 INSERT INTO public.correspondence_campaigns(id,company_id,created_by,title,kind)
 VALUES(c,a,u,'Clix investor campaign','investment');
 INSERT INTO public.correspondence_campaign_recipients(id,campaign_id,company_id,email,organization)
 VALUES(r,c,a,'investor@example.com','Investor');
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients WHERE campaign_id=c)<>1
 THEN RAISE EXCEPTION 'Campaign recipient not persisted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,company_id,email,organization)
  VALUES(c,b,'cross@example.com','Cross tenant');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-company campaign recipient accepted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,company_id,email,organization)
  VALUES(c,a,'INVESTOR@example.com','Duplicate');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate campaign recipient accepted'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,company_id,email,organization,document_id)
  VALUES(c,a,'other@example.com','Other','44444444-4444-4444-8444-444444444444');
  INSERT INTO public.correspondence_campaign_recipients(campaign_id,company_id,email,organization,document_id)
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
 INSERT INTO public.correspondence_mailboxes(id,company_id,address,account_id,region,encrypted_refresh_token,connected_by)
 VALUES(m,a,'info@bonds-global.com','123456789','com','encrypted-test-only',u);
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_mailboxes(company_id,address,account_id,region,encrypted_refresh_token,connected_by)
  VALUES(b,'INFO@BONDS-GLOBAL.COM','987654321','com','encrypted-test-only',u);
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Sender identity shared by two tenants'; END IF;
 INSERT INTO public.correspondence_campaign_dispatch_jobs
 (campaign_id,company_id,recipient_id,document_id,mailbox_id,issued_hash,idempotency_key)
 VALUES(c,a,r,'44444444-4444-4444-8444-444444444444',m,repeat('a',64),repeat('b',64));
 IF (SELECT count(*) FROM public.correspondence_campaign_dispatch_jobs WHERE campaign_id=c)<>1
 THEN RAISE EXCEPTION 'Dispatch job not persisted'; END IF;
 INSERT INTO public.correspondence_documents(id,company_id,status)
 VALUES('88888888-8888-4888-8888-888888888888',a,'issued');
 INSERT INTO public.correspondence_campaign_recipients(id,campaign_id,company_id,email,organization)
 VALUES('99999999-9999-4999-8999-999999999999',c,a,'separate@example.com','Separate');
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_dispatch_jobs
  (campaign_id,company_id,recipient_id,document_id,mailbox_id,issued_hash,idempotency_key)
  VALUES(c,b,'99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',m,repeat('a',64),repeat('c',64));
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-tenant dispatch job accepted'; END IF;
END $$;
