-- Bonds Deal Operating System - shared access, audit trail and lifecycle links.
-- Builds on 20261112003000_deal_workspace_foundation.sql.
-- Strictly additive and idempotent; destructive DDL/DML is intentionally absent.

alter table public.bonds_deals
  add column if not exists project_id uuid references public.bonds_projects(id) on delete set null;
alter table public.bonds_deals
  add column if not exists lifecycle_instance_id uuid references public.enterprise_lifecycle_instances(id) on delete set null;
alter table public.bonds_deals
  add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;

create index if not exists idx_bonds_deals_project
  on public.bonds_deals(project_id, status, updated_at desc)
  where project_id is not null;

create table if not exists public.bonds_deal_members (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  display_name text,
  organization text,
  side text not null default 'advisor'
    check (side in ('advisor','counterparty','external_expert')),
  member_role text not null default 'viewer'
    check (member_role in ('deal_manager','analyst','viewer','legal','auditor','investor_rep')),
  status text not null default 'invited'
    check (status in ('invited','active','revoked')),
  nda_status text not null default 'not_required'
    check (nda_status in ('not_required','pending','signed','declined')),
  nda_signed_at timestamptz,
  nda_reference text,
  access_expires_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or email is not null),
  check (email is null or email = lower(email)),
  check (side <> 'counterparty' or member_role in ('viewer','investor_rep','legal')),
  check (member_role <> 'deal_manager' or side = 'advisor')
);

create unique index if not exists uq_bonds_deal_members_user
  on public.bonds_deal_members(deal_id, user_id)
  where user_id is not null and status <> 'revoked';

create unique index if not exists uq_bonds_deal_members_email
  on public.bonds_deal_members(deal_id, email)
  where email is not null and status <> 'revoked';

create index if not exists idx_bonds_deal_members_user
  on public.bonds_deal_members(user_id, status)
  where user_id is not null;

create index if not exists idx_bonds_deal_members_invite_email
  on public.bonds_deal_members(email, status)
  where user_id is null;

create table if not exists public.bonds_deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_events_deal
  on public.bonds_deal_events(deal_id, created_at desc);

create or replace function public.prevent_bonds_deal_event_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'bonds_deal_events is append-only';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_members_updated_at'
      and tgrelid = 'public.bonds_deal_members'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_members_updated_at
    before update on public.bonds_deal_members
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_events_append_only'
      and tgrelid = 'public.bonds_deal_events'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_events_append_only
    before update or delete on public.bonds_deal_events
    for each row execute function public.prevent_bonds_deal_event_mutation();
  end if;
end;
$$;

-- Returns the caller's usable side on a deal ('owner', 'advisor', 'counterparty',
-- 'external_expert') or null. SECURITY DEFINER avoids recursive RLS evaluation.
create or replace function public.bonds_deal_access_side(p_deal_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'owner' from public.bonds_deals d
      where d.id = p_deal_id and d.user_id = auth.uid()),
    (select m.side from public.bonds_deal_members m
      where m.deal_id = p_deal_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and (m.access_expires_at is null or m.access_expires_at > now())
      limit 1)
  );
$$;

revoke all on function public.bonds_deal_access_side(uuid) from public;
grant execute on function public.bonds_deal_access_side(uuid) to authenticated, service_role;

alter table public.bonds_deal_members enable row level security;
alter table public.bonds_deal_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bonds_deals' and policyname = 'bonds_deals_member_select') then
    create policy bonds_deals_member_select on public.bonds_deals
      for select to authenticated
      using (public.bonds_deal_access_side(id) is not null);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bonds_deal_members' and policyname = 'bonds_deal_members_team_select') then
    create policy bonds_deal_members_team_select on public.bonds_deal_members
      for select to authenticated
      using (
        user_id = auth.uid()
        or public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert')
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bonds_deal_events' and policyname = 'bonds_deal_events_team_select') then
    create policy bonds_deal_events_team_select on public.bonds_deal_events
      for select to authenticated
      using (public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert'));
  end if;
end;
$$;

revoke all on public.bonds_deal_members from anon;
revoke all on public.bonds_deal_events from anon;

grant select on public.bonds_deal_members to authenticated;
grant select on public.bonds_deal_events to authenticated;

grant all on public.bonds_deal_members to service_role;
grant select, insert on public.bonds_deal_events to service_role;
