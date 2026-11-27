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