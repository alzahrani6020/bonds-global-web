begin;

create table if not exists public.accounting_entity_members (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','accountant','viewer')),
  status text not null default 'active'
    check (status in ('active','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, user_id)
);

create index if not exists idx_accounting_entity_members_user_active
  on public.accounting_entity_members(user_id, accounting_entity_id)
  where status = 'active';

create index if not exists idx_accounting_entity_members_entity_role
  on public.accounting_entity_members(accounting_entity_id, role)
  where status = 'active';

alter table public.accounting_entity_members enable row level security;

revoke all on public.accounting_entity_members from anon, authenticated;
grant select on public.accounting_entity_members to authenticated;
grant select, insert, update, delete on public.accounting_entity_members to service_role;

drop policy if exists accounting_entity_members_self_select
  on public.accounting_entity_members;

create policy accounting_entity_members_self_select
on public.accounting_entity_members
for select
to authenticated
using (
  user_id = (select auth.uid())
);

create or replace function public.accounting_user_can_access_entity(
  p_accounting_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.accounting_entity_members m
      join public.accounting_entities e
        on e.id = m.accounting_entity_id
      where m.accounting_entity_id = p_accounting_entity_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and e.status = 'active'
    );
$$;

revoke all on function public.accounting_user_can_access_entity(uuid) from public;
revoke all on function public.accounting_user_can_access_entity(uuid) from anon;
grant execute on function public.accounting_user_can_access_entity(uuid) to authenticated, service_role;

create or replace function public.accounting_user_ledger_balances(
  p_accounting_entity_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  account_code text,
  account_name text,
  account_type text,
  debit numeric,
  credit numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.accounting_user_can_access_entity(p_accounting_entity_id) then
    raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'ACCOUNTING_REPORT_DATE_RANGE_INVALID';
  end if;

  return query
  select
    a.code,
    a.name,
    a.account_type,
    coalesce(sum(l.debit),0)::numeric,
    coalesce(sum(l.credit),0)::numeric
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id = j.accounting_entity_id
   and l.journal_entry_id = j.id
  join public.accounting_accounts a
    on a.accounting_entity_id = l.accounting_entity_id
   and a.id = l.account_id
  where j.accounting_entity_id = p_accounting_entity_id
    and j.status = 'posted'
    and (p_from is null or j.effective_at::date >= p_from)
    and (p_to is null or j.effective_at::date <= p_to)
  group by a.code, a.name, a.account_type
  having coalesce(sum(l.debit),0) <> 0
      or coalesce(sum(l.credit),0) <> 0
  order by a.code;
end;
$$;

revoke all on function public.accounting_user_ledger_balances(uuid,date,date) from public;
revoke all on function public.accounting_user_ledger_balances(uuid,date,date) from anon;
grant execute on function public.accounting_user_ledger_balances(uuid,date,date)
  to authenticated, service_role;

create or replace function public.accounting_seed_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.accounting_entity_members(
      accounting_entity_id,
      user_id,
      role,
      status,
      created_by
    )
    values (
      new.id,
      new.created_by,
      'owner',
      'active',
      new.created_by
    )
    on conflict (accounting_entity_id, user_id)
    do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.accounting_seed_owner_membership() from public, anon, authenticated;
grant execute on function public.accounting_seed_owner_membership() to service_role;

drop trigger if exists trg_accounting_seed_owner_membership
  on public.accounting_entities;

create trigger trg_accounting_seed_owner_membership
after insert on public.accounting_entities
for each row execute function public.accounting_seed_owner_membership();

insert into public.accounting_entity_members(
  accounting_entity_id,
  user_id,
  role,
  status,
  created_by
)
select
  e.id,
  e.created_by,
  'owner',
  'active',
  e.created_by
from public.accounting_entities e
where e.created_by is not null
on conflict (accounting_entity_id, user_id)
do nothing;

commit;
