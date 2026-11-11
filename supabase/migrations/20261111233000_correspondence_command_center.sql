-- Correspondence command center Wave 1-2.
-- Additive only: task assignment/SLA, delivery state, and document governance policy.

alter table public.correspondence_documents
  add column if not exists requires_signature boolean not null default true,
  add column if not exists requires_stamp boolean not null default false,
  add column if not exists delivery_status text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_provider text,
  add column if not exists delivery_updated_at timestamptz;

alter table public.correspondence_documents
  drop constraint if exists correspondence_documents_delivery_status_check;

alter table public.correspondence_documents
  add constraint correspondence_documents_delivery_status_check
  check (
    delivery_status is null
    or delivery_status in ('queued','accepted','delivered','failed','bounced','complained')
  );

create index if not exists idx_correspondence_delivery_status
  on public.correspondence_documents(delivery_status, delivery_updated_at desc);

create index if not exists idx_correspondence_provider_message
  on public.correspondence_documents(provider_message_id)
  where provider_message_id is not null;

create table if not exists public.correspondence_tasks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.correspondence_documents(id) on delete cascade,
  task_type text not null check (
    task_type in ('review','approve','sign','stamp','finalize_pdf','send','archive','follow_up')
  ),
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_role text,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, task_type)
);

create index if not exists idx_correspondence_tasks_work
  on public.correspondence_tasks(status, assigned_user_id, assigned_role, due_at);

create index if not exists idx_correspondence_tasks_document
  on public.correspondence_tasks(document_id, created_at desc);

alter table public.correspondence_tasks enable row level security;
revoke all on public.correspondence_tasks from anon, authenticated;
grant all on public.correspondence_tasks to service_role;

create or replace function public.touch_correspondence_task_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_correspondence_task_updated_at on public.correspondence_tasks;
create trigger trg_correspondence_task_updated_at
before update on public.correspondence_tasks
for each row execute function public.touch_correspondence_task_updated_at();


create table if not exists public.correspondence_user_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (
    permission in ('review','approve','sign','stamp','issue','finalize_pdf','send','archive','read_all')
  ),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key(user_id, permission)
);

create index if not exists idx_correspondence_user_permissions_permission
  on public.correspondence_user_permissions(permission, user_id);

alter table public.correspondence_user_permissions enable row level security;
revoke all on public.correspondence_user_permissions from anon, authenticated;
grant all on public.correspondence_user_permissions to service_role;
