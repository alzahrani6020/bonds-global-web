-- Future issuances only. Do not rewrite, revoke or reactivate historical issues.
-- A replacement is not effective until its immutable archived PDF is bound.
-- This migration is intentionally unapplied until disposable DB acceptance.

alter table public.correspondence_issues
  drop constraint if exists correspondence_issues_state_check;
alter table public.correspondence_issues
  add constraint correspondence_issues_state_check
  check (state in ('pending', 'active', 'revoked', 'superseded'));

create or replace function public.capture_correspondence_issue()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  previous_issue public.correspondence_issues%rowtype;
  next_version integer := 1;
begin
  if new.status <> 'issued' or old.status = 'issued' then
    return new;
  end if;

  if new.related_document_id is not null then
    select * into previous_issue
    from public.correspondence_issues
    where document_id = new.related_document_id
    order by issue_version desc, issued_at desc
    limit 1;
    if found then
      next_version := previous_issue.issue_version + 1;
    end if;
  end if;

  -- The issue exists for governance, but is not yet a valid replacement.
  insert into public.correspondence_issues (
    document_id, issue_version, issue_number, verification_token, state,
    document_version, document_hash, issued_hash, pdf_hash,
    signature_hash, stamp_hash, issued_by, issued_at, supersedes_issue_id
  ) values (
    new.id, next_version,
    coalesce(new.outgoing_number, new.incoming_number, new.reference_number, new.id::text),
    new.verification_token, 'pending', new.current_version,
    new.document_hash, new.issued_hash, null,
    new.signature_hash, new.stamp_hash, new.issued_by, new.issued_at,
    case when previous_issue.id is not null then previous_issue.id else null end
  )
  on conflict (verification_token) do nothing;

  -- The predecessor must remain unchanged until the new PDF is finalized.
  return new;
end;
$function$;

create or replace function public.activate_correspondence_issue_after_final_pdf()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_issue public.correspondence_issues%rowtype;
begin
  if old.artifact_hash is not null or new.artifact_hash is null then
    return new;
  end if;

  if new.status <> 'issued'
     or new.artifact_path is null
     or new.artifact_document_hash is distinct from new.document_hash
     or new.artifact_issued_hash is distinct from new.issued_hash
     or new.artifact_version is distinct from new.current_version then
    raise exception 'Final PDF binding is incomplete or inconsistent'
      using errcode = '23514';
  end if;

  select * into current_issue
  from public.correspondence_issues
  where document_id = new.id
    and verification_token = new.verification_token
  for update;

  if not found or current_issue.state <> 'pending'
     or current_issue.document_hash is distinct from new.document_hash
     or current_issue.issued_hash is distinct from new.issued_hash
     or current_issue.document_version is distinct from new.current_version then
    raise exception 'Pending issue not eligible for PDF activation'
      using errcode = '23514';
  end if;

  update public.correspondence_issues
     set pdf_hash = new.artifact_hash,
         state = 'active'
   where id = current_issue.id and state = 'pending';

  -- Same database transaction: failure rolls both updates back.
  if current_issue.supersedes_issue_id is not null then
    -- Exactly one successor may replace an active predecessor. A competing
    -- activation, revoked predecessor or stale link must roll back everything,
    -- including the document's artifact binding and new issue activation.
    update public.correspondence_issues
       set state = 'superseded'
     where id = current_issue.supersedes_issue_id
       and state = 'active'
       and pdf_hash is not null;

    if not found then
      raise exception 'Predecessor is not active with a finalized PDF'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_activate_correspondence_issue_after_final_pdf
  on public.correspondence_documents;
create trigger trg_activate_correspondence_issue_after_final_pdf
after update of artifact_hash on public.correspondence_documents
for each row
when (old.artifact_hash is null and new.artifact_hash is not null)
execute function public.activate_correspondence_issue_after_final_pdf();

revoke execute on function public.activate_correspondence_issue_after_final_pdf()
  from public, anon, authenticated;
grant execute on function public.activate_correspondence_issue_after_final_pdf()
  to service_role;
