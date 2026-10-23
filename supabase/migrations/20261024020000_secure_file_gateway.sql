-- Secure File Gateway: quarantine, scanner verdicts, and audit trail.
-- Existing approved records are backfilled as legacy clean; all new records default to quarantined.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents-quarantine',
  'client-documents-quarantine',
  false,
  10485760,
  array[
    'image/*',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists client_documents_quarantine_insert on storage.objects;
create policy client_documents_quarantine_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents-quarantine'
    and owner = (select auth.uid())
  );

drop policy if exists client_documents_quarantine_delete on storage.objects;
create policy client_documents_quarantine_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-documents-quarantine'
    and owner = (select auth.uid())
  );

alter table public.client_documents
  add column if not exists storage_bucket text not null default 'client-documents',
  add column if not exists security_status text not null default 'quarantined',
  add column if not exists security_verdict text not null default 'pending',
  add column if not exists sha256 text,
  add column if not exists detected_mime text,
  add column if not exists risk_score integer,
  add column if not exists scanner_name text,
  add column if not exists scanner_version text,
  add column if not exists signature_version text,
  add column if not exists security_policy_version text not null default '1',
  add column if not exists security_details jsonb not null default '{}'::jsonb,
  add column if not exists scan_started_at timestamptz,
  add column if not exists scan_completed_at timestamptz;

update public.client_documents
set security_status = 'clean',
    security_verdict = 'clean',
    storage_bucket = coalesce(nullif(storage_bucket, ''), 'client-documents')
where storage_bucket = 'client-documents'
  and security_verdict = 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_documents_security_status_check'
  ) then
    alter table public.client_documents
      add constraint client_documents_security_status_check
      check (security_status in (
        'quarantined','scanning','clean','suspicious','infected',
        'rejected','scan_error'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'client_documents_security_verdict_check'
  ) then
    alter table public.client_documents
      add constraint client_documents_security_verdict_check
      check (security_verdict in (
        'pending','clean','suspicious','malicious','unknown','scanner_unavailable'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'client_documents_risk_score_check'
  ) then
    alter table public.client_documents
      add constraint client_documents_risk_score_check
      check (risk_score is null or (risk_score between 0 and 100));
  end if;
end $$;

create table if not exists public.file_security_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.client_documents(id) on delete cascade,
  event_type text not null,
  verdict text,
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_file_security_events_document
  on public.file_security_events(document_id, created_at desc);

alter table public.file_security_events enable row level security;

drop policy if exists file_security_events_client_select on public.file_security_events;
create policy file_security_events_client_select
  on public.file_security_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.client_documents d
      join public.advisory_clients c on c.id = d.client_id
      where d.id = file_security_events.document_id
        and c.auth_user_id = (select auth.uid())
    )
  );

grant select on public.file_security_events to authenticated;
