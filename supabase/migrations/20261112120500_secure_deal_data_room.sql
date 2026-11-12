-- Bonds Deal Operating System - F.2 secure data room and due-diligence workflow.
-- Additive only. Existing migrations remain immutable.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'deal-data-room',
  'deal-data-room',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do nothing;

alter table public.bonds_deal_documents
  add column if not exists visibility text not null default 'team'
    check (visibility in ('team','counterparty','selected'));

alter table public.bonds_deal_due_diligence_items
  add column if not exists assigned_member_id uuid references public.bonds_deal_members(id) on delete set null;
alter table public.bonds_deal_due_diligence_items
  add column if not exists due_at timestamptz;
alter table public.bonds_deal_due_diligence_items
  add column if not exists evidence_document_id uuid references public.bonds_deal_documents(id) on delete set null;
alter table public.bonds_deal_due_diligence_items
  add column if not exists remediation text;
alter table public.bonds_deal_due_diligence_items
  add column if not exists resolution_note text;

create table if not exists public.bonds_deal_document_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general',
  requested_from_member_id uuid references public.bonds_deal_members(id) on delete set null,
  status text not null default 'open'
    check (status in ('open','submitted','fulfilled','waived')),
  due_at timestamptz,
  document_id uuid references public.bonds_deal_documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  fulfilled_by uuid references auth.users(id) on delete set null,
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_document_requests_work
  on public.bonds_deal_document_requests(deal_id, status, due_at);

create index if not exists idx_bonds_deal_document_requests_member
  on public.bonds_deal_document_requests(requested_from_member_id, status)
  where requested_from_member_id is not null;

create table if not exists public.bonds_deal_document_versions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  document_id uuid not null references public.bonds_deal_documents(id) on delete cascade,
  request_id uuid references public.bonds_deal_document_requests(id) on delete set null,
  version integer not null check (version >= 1),
  file_name text not null,
  storage_bucket text not null default 'deal-data-room',
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  checksum_sha256 text,
  upload_status text not null default 'pending'
    check (upload_status in ('pending','ready','failed')),
  uploaded_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_id, version)
);

create index if not exists idx_bonds_deal_document_versions_document
  on public.bonds_deal_document_versions(document_id, version desc);

create table if not exists public.bonds_deal_document_grants (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  document_id uuid not null references public.bonds_deal_documents(id) on delete cascade,
  member_id uuid not null references public.bonds_deal_members(id) on delete cascade,
  access_level text not null default 'download'
    check (access_level in ('view','download')),
  status text not null default 'active'
    check (status in ('active','revoked')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, member_id)
);

create index if not exists idx_bonds_deal_document_grants_member
  on public.bonds_deal_document_grants(member_id, status);

create table if not exists public.bonds_deal_document_access_log (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  document_id uuid references public.bonds_deal_documents(id) on delete set null,
  version_id uuid references public.bonds_deal_document_versions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null
    check (action in (
      'upload_url_created',
      'upload_confirmed',
      'download_url_created',
      'request_created',
      'request_submitted',
      'request_fulfilled',
      'grant_changed',
      'due_diligence_updated'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_document_access_log_deal
  on public.bonds_deal_document_access_log(deal_id, created_at desc);

create or replace function public.prevent_bonds_deal_document_access_log_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'bonds_deal_document_access_log is append-only';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_document_requests_updated_at'
      and tgrelid = 'public.bonds_deal_document_requests'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_document_requests_updated_at
    before update on public.bonds_deal_document_requests
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_document_grants_updated_at'
      and tgrelid = 'public.bonds_deal_document_grants'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_document_grants_updated_at
    before update on public.bonds_deal_document_grants
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_document_access_log_append_only'
      and tgrelid = 'public.bonds_deal_document_access_log'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_document_access_log_append_only
    before update or delete on public.bonds_deal_document_access_log
    for each row execute function public.prevent_bonds_deal_document_access_log_mutation();
  end if;
end;
$$;

alter table public.bonds_deal_document_requests enable row level security;
alter table public.bonds_deal_document_versions enable row level security;
alter table public.bonds_deal_document_grants enable row level security;
alter table public.bonds_deal_document_access_log enable row level security;

revoke all on public.bonds_deal_document_requests from anon, authenticated;
revoke all on public.bonds_deal_document_versions from anon, authenticated;
revoke all on public.bonds_deal_document_grants from anon, authenticated;
revoke all on public.bonds_deal_document_access_log from anon, authenticated;

grant all on public.bonds_deal_document_requests to service_role;
grant all on public.bonds_deal_document_versions to service_role;
grant all on public.bonds_deal_document_grants to service_role;
grant select, insert on public.bonds_deal_document_access_log to service_role;
