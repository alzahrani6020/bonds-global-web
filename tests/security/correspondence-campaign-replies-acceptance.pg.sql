-- Reply matching metadata remains private and foreign-key bound to the campaign.
DO $$
DECLARE a uuid='22222222-2222-4222-8222-222222222222';
 b uuid='33333333-3333-4333-8333-333333333333';
 c uuid='55555555-5555-4555-8555-555555555555';
 r uuid='66666666-6666-4666-8666-666666666666';
 m uuid='77777777-7777-4777-8777-777777777777';
 rejected boolean;
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.correspondence_campaign_replies'::regclass)
 THEN RAISE EXCEPTION 'Reply ledger RLS is disabled'; END IF;
 IF has_table_privilege('anon','public.correspondence_campaign_replies','SELECT') OR
    has_table_privilege('authenticated','public.correspondence_campaign_replies','SELECT')
 THEN RAISE EXCEPTION 'Reply metadata is exposed to browser roles'; END IF;
 INSERT INTO public.correspondence_campaign_replies
 (workspace_id,campaign_id,recipient_id,mailbox_id,provider_message_id,provider_thread_id,from_address,subject)
 VALUES(a,c,r,m,'123456789','987654321','investor@example.com','Re: BONDS Letter');
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_replies
  (workspace_id,campaign_id,recipient_id,mailbox_id,provider_message_id,provider_thread_id,from_address)
  VALUES(a,c,r,m,'123456789','987654321','investor@example.com');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate Zoho message was archived twice'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.correspondence_campaign_replies
  (workspace_id,campaign_id,recipient_id,mailbox_id,provider_message_id,provider_thread_id,from_address)
  VALUES(b,c,r,m,'222222222','987654321','investor@example.com');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Reply from another workspace attached to campaign'; END IF;
END $$;

-- This file runs in a SECOND psql process after the campaigns acceptance
-- script. It confirms committed PostgreSQL readback, not just in-transaction
-- visibility inside the original connection.
DO $$
DECLARE
 a uuid='22222222-2222-4222-8222-222222222222';
 b uuid='33333333-3333-4333-8333-333333333333';
 ua uuid='11111111-1111-4111-8111-111111111111';
 ub uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 ca uuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 cb uuid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
BEGIN
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
   WHERE campaign_id=ca AND workspace_id=a AND status='prepared') <> 27
 THEN RAISE EXCEPTION 'Committed readback lost tenant A 27 recipients'; END IF;
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients r
    JOIN public.correspondence_documents d ON d.id=r.draft_document_id
    WHERE r.campaign_id=ca AND r.workspace_id=a
      AND d.owner_user_id=ua AND d.status='draft'
      AND d.workspace_context->>'campaign_workspace_id'=a::text
      AND d.workspace_context->>'campaign_recipient_id'=r.id::text) <> 27
 THEN RAISE EXCEPTION 'Committed readback lost tenant A 27 bound drafts'; END IF;
 IF (SELECT count(*) FROM public.correspondence_campaign_recipients
   WHERE campaign_id=cb AND workspace_id=b) <> 1
 THEN RAISE EXCEPTION 'Committed readback lost company B recipient'; END IF;
 IF (SELECT created_by FROM public.correspondence_campaigns WHERE id=ca)
    IS DISTINCT FROM ua OR
    (SELECT created_by FROM public.correspondence_campaigns WHERE id=cb)
    IS DISTINCT FROM ub
 THEN RAISE EXCEPTION 'Campaign owners crossed company boundary'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.correspondence_campaign_recipients r
   JOIN public.correspondence_campaigns c ON c.id=r.campaign_id
   WHERE r.workspace_id<>c.workspace_id
 ) THEN RAISE EXCEPTION 'Cross-tenant row survives committed readback'; END IF;
END $$;
