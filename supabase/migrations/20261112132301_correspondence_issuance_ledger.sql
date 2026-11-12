alter table public.correspondence_documents
  add column if not exists signer_name text,
  add column if not exists signer_title text;

create table if not exists public.correspondence_issues (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.correspondence_documents(id) on delete restrict,
  issue_version integer not null check (issue_version >= 1),
  issue_number text not null,
  verification_token uuid not null unique,
  state text not null default 'active' check (state in ('active','revoked','superseded')),
  document_version integer not null,
  document_hash text,
  issued_hash text not null,
  pdf_hash text,
  signature_hash text,
  stamp_hash text,
  issued_by uuid,
  issued_at timestamptz not null,
  supersedes_issue_id uuid references public.correspondence_issues(id) on delete set null,
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason text,
  verification_count bigint not null default 0 check (verification_count >= 0),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_id, issue_version)
);

create index if not exists idx_correspondence_issues_document
  on public.correspondence_issues(document_id, issue_version desc);

create index if not exists idx_correspondence_issues_number
  on public.correspondence_issues(issue_number);

create index if not exists idx_correspondence_issues_state
  on public.correspondence_issues(state, issued_at desc);

alter table public.correspondence_issues enable row level security;
revoke all on table public.correspondence_issues from anon, authenticated;
grant select, insert, update on table public.correspondence_issues to service_role;

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
    select *
      into previous_issue
      from public.correspondence_issues
     where document_id = new.related_document_id
     order by issue_version desc, issued_at desc
     limit 1;

    if found then
      next_version := previous_issue.issue_version + 1;
    end if;
  end if;

  insert into public.correspondence_issues (
    document_id, issue_version, issue_number, verification_token, state,
    document_version, document_hash, issued_hash, pdf_hash,
    signature_hash, stamp_hash, issued_by, issued_at, supersedes_issue_id
  )
  values (
    new.id,
    next_version,
    coalesce(new.outgoing_number, new.incoming_number, new.reference_number, new.id::text),
    new.verification_token,
    'active',
    new.current_version,
    new.document_hash,
    new.issued_hash,
    new.artifact_hash,
    new.signature_hash,
    new.stamp_hash,
    new.issued_by,
    new.issued_at,
    case when previous_issue.id is not null then previous_issue.id else null end
  )
  on conflict (verification_token) do nothing;

  if previous_issue.id is not null then
    update public.correspondence_issues
       set state = 'superseded'
     where id = previous_issue.id
       and state = 'active';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_capture_correspondence_issue on public.correspondence_documents;
create trigger trg_capture_correspondence_issue
after update of status on public.correspondence_documents
for each row
when (new.status = 'issued' and old.status is distinct from new.status)
execute function public.capture_correspondence_issue();

revoke execute on function public.capture_correspondence_issue() from public, anon, authenticated;
grant execute on function public.capture_correspondence_issue() to service_role;

insert into public.correspondence_issues (
  document_id, issue_version, issue_number, verification_token, state,
  document_version, document_hash, issued_hash, pdf_hash,
  signature_hash, stamp_hash, issued_by, issued_at
)
select
  d.id,
  1,
  coalesce(d.outgoing_number, d.incoming_number, d.reference_number, d.id::text),
  d.verification_token,
  'active',
  d.current_version,
  d.document_hash,
  d.issued_hash,
  d.artifact_hash,
  d.signature_hash,
  d.stamp_hash,
  d.issued_by,
  d.issued_at
from public.correspondence_documents d
where d.verification_token is not null
  and d.issued_hash is not null
  and d.status in ('issued','sent','archived')
on conflict (verification_token) do nothing;
