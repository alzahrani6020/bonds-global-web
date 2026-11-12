alter table public.correspondence_documents
  add column if not exists artifact_document_hash text,
  add column if not exists artifact_issued_hash text,
  add column if not exists artifact_version integer,
  add column if not exists send_idempotency_key text;

create unique index if not exists idx_correspondence_send_idempotency_key
  on public.correspondence_documents(send_idempotency_key)
  where send_idempotency_key is not null;

create or replace function public.save_correspondence_version_atomic(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_pages_html jsonb,
  p_text_content text,
  p_checksum_sha256 text,
  p_title text,
  p_subject text,
  p_direction text,
  p_priority text,
  p_confidentiality text,
  p_recipient_organization text,
  p_recipient_name text,
  p_recipient_title text,
  p_recipient_email text,
  p_sender_department text,
  p_company_id uuid,
  p_workspace_context jsonb
)
returns table(document jsonb, version integer, checksum_sha256 text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_doc public.correspondence_documents%rowtype;
  v_next integer;
begin
  select * into v_doc
  from public.correspondence_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Correspondence document not found' using errcode = 'P0002';
  end if;
  if v_doc.owner_user_id <> p_actor_user_id then
    raise exception 'Only the document owner can edit the draft' using errcode = '42501';
  end if;
  if v_doc.status not in ('draft', 'returned') then
    raise exception 'Workflow-controlled documents are immutable' using errcode = '55000';
  end if;

  select greatest(coalesce(v_doc.current_version, 0), coalesce(max(v.version), 0)) + 1
    into v_next
  from public.correspondence_versions v
  where v.document_id = p_document_id;

  insert into public.correspondence_versions (
    document_id, version, pages_html, text_content, checksum_sha256, created_by
  ) values (
    p_document_id, v_next, p_pages_html, p_text_content, p_checksum_sha256, p_actor_user_id
  );

  update public.correspondence_documents
  set current_version = v_next,
      document_hash = p_checksum_sha256,
      title = p_title,
      subject = p_subject,
      direction = p_direction,
      priority = p_priority,
      confidentiality = p_confidentiality,
      recipient_organization = p_recipient_organization,
      recipient_name = p_recipient_name,
      recipient_title = p_recipient_title,
      recipient_email = p_recipient_email,
      sender_department = p_sender_department,
      company_id = p_company_id,
      workspace_context = coalesce(p_workspace_context, '{}'::jsonb),
      signed_by = null,
      signed_at = null,
      signature_image_data = null,
      signature_hash = null,
      stamped_by = null,
      stamped_at = null,
      stamp_hash = null,
      issued_hash = null,
      artifact_path = null,
      artifact_hash = null,
      artifact_size_bytes = null,
      artifact_created_at = null,
      artifact_document_hash = null,
      artifact_issued_hash = null,
      artifact_version = null,
      send_idempotency_key = null,
      delivery_status = null,
      provider_message_id = null,
      delivery_provider = null,
      delivery_updated_at = null
  where id = p_document_id
  returning * into v_doc;

  insert into public.correspondence_events (
    document_id, actor_user_id, action, from_status, to_status, version, metadata
  ) values (
    p_document_id, p_actor_user_id, 'version_saved', v_doc.status, v_doc.status, v_next,
    jsonb_build_object('checksum_sha256', p_checksum_sha256)
  );

  return query select to_jsonb(v_doc), v_next, p_checksum_sha256;
end;
$$;

revoke all on function public.save_correspondence_version_atomic(
  uuid,uuid,jsonb,text,text,text,text,text,text,text,text,text,text,text,text,uuid,jsonb
) from public, anon, authenticated;

grant execute on function public.save_correspondence_version_atomic(
  uuid,uuid,jsonb,text,text,text,text,text,text,text,text,text,text,text,text,uuid,jsonb
) to service_role;
