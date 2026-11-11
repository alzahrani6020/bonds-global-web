-- Dynamic correspondence governance for Letterhead.
-- Additive/non-destructive. All client access goes through authenticated server APIs.

create table if not exists public.correspondence_sequences (
  year integer primary key,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.correspondence_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  language text not null default 'ar' check (language in ('ar','en')),
  direction text not null default 'outgoing' check (direction in ('incoming','outgoing','internal')),
  document_type text not null default 'letter',
  title text not null default 'Untitled',
  subject text,
  recipient_organization text,
  recipient_name text,
  recipient_title text,
  recipient_email text,
  sender_department text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  confidentiality text not null default 'internal' check (confidentiality in ('public','internal','confidential','restricted')),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','issued','sent','archived','returned','rejected','cancelled')),
  reference_number text unique,
  current_version integer not null default 0 check (current_version >= 0),
  document_hash text,
  verification_token uuid unique,
  workspace_context jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  signature_image_data text,
  signature_hash text,
  stamped_by uuid references auth.users(id) on delete set null,
  stamped_at timestamptz,
  stamp_hash text,
  issued_hash text,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  issued_at timestamptz,
  sent_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_correspondence_owner_status on public.correspondence_documents(owner_user_id,status,updated_at desc);
create index if not exists idx_correspondence_company_status on public.correspondence_documents(company_id,status,updated_at desc);
create index if not exists idx_correspondence_reference on public.correspondence_documents(reference_number);
create index if not exists idx_correspondence_verification on public.correspondence_documents(verification_token);

create table if not exists public.correspondence_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.correspondence_documents(id) on delete cascade,
  version integer not null check (version > 0),
  pages_html jsonb not null default '[]'::jsonb,
  text_content text,
  checksum_sha256 text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(document_id,version)
);

create index if not exists idx_correspondence_versions_document on public.correspondence_versions(document_id,version desc);

create table if not exists public.correspondence_events (
  id bigserial primary key,
  document_id uuid not null references public.correspondence_documents(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  version integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_correspondence_events_document on public.correspondence_events(document_id,created_at desc);

alter table public.correspondence_sequences enable row level security;
alter table public.correspondence_documents enable row level security;
alter table public.correspondence_versions enable row level security;
alter table public.correspondence_events enable row level security;

revoke all on public.correspondence_sequences, public.correspondence_documents, public.correspondence_versions, public.correspondence_events from anon, authenticated;
grant all on public.correspondence_sequences, public.correspondence_documents, public.correspondence_versions, public.correspondence_events to service_role;
grant usage, select on sequence public.correspondence_events_id_seq to service_role;

create or replace function public.next_correspondence_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from now())::integer;
  n integer;
begin
  insert into public.correspondence_sequences(year,last_number,updated_at)
  values (y,1,now())
  on conflict(year) do update
    set last_number = public.correspondence_sequences.last_number + 1,
        updated_at = now()
  returning last_number into n;

  return 'BDS-' || y::text || '-' || lpad(n::text,6,'0');
end;
$$;

revoke all on function public.next_correspondence_reference() from public, anon, authenticated;
grant execute on function public.next_correspondence_reference() to service_role;

create or replace function public.touch_correspondence_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_correspondence_updated_at on public.correspondence_documents;
create trigger trg_correspondence_updated_at
before update on public.correspondence_documents
for each row execute function public.touch_correspondence_updated_at();
