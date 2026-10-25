begin;

create table if not exists public.accounting_cash_accounts (
  accounting_entity_id uuid not null,
  account_id uuid not null,
  status text not null default 'active'
    check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (accounting_entity_id, account_id),
  foreign key (accounting_entity_id, account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete cascade
);

create table if not exists public.accounting_cash_flow_policies (
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete cascade,
  event_type text not null,
  cash_flow_category text not null
    check (cash_flow_category in ('operating','investing','financing')),
  status text not null default 'active'
    check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (accounting_entity_id, event_type)
);

create index if not exists idx_accounting_cash_accounts_active
  on public.accounting_cash_accounts(accounting_entity_id, account_id)
  where status = 'active';

create index if not exists idx_accounting_cash_flow_policies_active
  on public.accounting_cash_flow_policies(accounting_entity_id, event_type)
  where status = 'active';

alter table public.accounting_cash_accounts enable row level security;
alter table public.accounting_cash_flow_policies enable row level security;

revoke all on public.accounting_cash_accounts from anon, authenticated;
revoke all on public.accounting_cash_flow_policies from anon, authenticated;
grant select, insert, update, delete on public.accounting_cash_accounts to service_role;
grant select, insert, update, delete on public.accounting_cash_flow_policies to service_role;

create or replace function public.accounting_user_cash_balance(
  p_accounting_entity_id uuid,
  p_before date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.accounting_user_can_access_entity(p_accounting_entity_id) then
    raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED';
  end if;

  if p_before is null then
    raise exception 'CASH_FLOW_BALANCE_DATE_REQUIRED';
  end if;

  select coalesce(sum(l.debit - l.credit),0)
    into v_balance
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id = j.accounting_entity_id
   and l.journal_entry_id = j.id
  join public.accounting_cash_accounts ca
    on ca.accounting_entity_id = l.accounting_entity_id
   and ca.account_id = l.account_id
   and ca.status = 'active'
  where j.accounting_entity_id = p_accounting_entity_id
    and j.status = 'posted'
    and j.effective_at::date < p_before;

  return coalesce(v_balance,0);
end;
$$;

revoke all on function public.accounting_user_cash_balance(uuid,date) from public, anon;
grant execute on function public.accounting_user_cash_balance(uuid,date)
  to authenticated, service_role;

create or replace function public.accounting_user_cash_flow_movements(
  p_accounting_entity_id uuid,
  p_from date,
  p_to date
)
returns table (
  financial_event_id uuid,
  event_key text,
  event_type text,
  effective_date date,
  cash_flow_category text,
  cash_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unclassified integer;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.accounting_user_can_access_entity(p_accounting_entity_id) then
    raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED';
  end if;

  if p_from is null or p_to is null then
    raise exception 'CASH_FLOW_DATE_RANGE_REQUIRED';
  end if;

  if p_from > p_to then
    raise exception 'CASH_FLOW_DATE_RANGE_INVALID';
  end if;

  select count(*)
    into v_unclassified
  from (
    select j.financial_event_id
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id = j.accounting_entity_id
     and l.journal_entry_id = j.id
    join public.accounting_cash_accounts ca
      on ca.accounting_entity_id = l.accounting_entity_id
     and ca.account_id = l.account_id
     and ca.status = 'active'
    join public.financial_events e
      on e.accounting_entity_id = j.accounting_entity_id
     and e.id = j.financial_event_id
    left join public.accounting_cash_flow_policies p
      on p.accounting_entity_id = e.accounting_entity_id
     and p.event_type = e.event_type
     and p.status = 'active'
    where j.accounting_entity_id = p_accounting_entity_id
      and j.status = 'posted'
      and j.effective_at::date between p_from and p_to
    group by j.financial_event_id, p.cash_flow_category
    having abs(sum(l.debit - l.credit)) > 0.005
       and p.cash_flow_category is null
  ) missing;

  if v_unclassified > 0 then
    raise exception 'CASH_FLOW_CLASSIFICATION_REQUIRED';
  end if;

  return query
  select
    e.id,
    e.event_key,
    e.event_type,
    j.effective_at::date,
    p.cash_flow_category,
    round(sum(l.debit - l.credit)::numeric,2)
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id = j.accounting_entity_id
   and l.journal_entry_id = j.id
  join public.accounting_cash_accounts ca
    on ca.accounting_entity_id = l.accounting_entity_id
   and ca.account_id = l.account_id
   and ca.status = 'active'
  join public.financial_events e
    on e.accounting_entity_id = j.accounting_entity_id
   and e.id = j.financial_event_id
  join public.accounting_cash_flow_policies p
    on p.accounting_entity_id = e.accounting_entity_id
   and p.event_type = e.event_type
   and p.status = 'active'
  where j.accounting_entity_id = p_accounting_entity_id
    and j.status = 'posted'
    and j.effective_at::date between p_from and p_to
  group by e.id, e.event_key, e.event_type, j.effective_at::date, p.cash_flow_category
  having abs(sum(l.debit - l.credit)) > 0.005
  order by j.effective_at::date, e.event_key;
end;
$$;

revoke all on function public.accounting_user_cash_flow_movements(uuid,date,date) from public, anon;
grant execute on function public.accounting_user_cash_flow_movements(uuid,date,date)
  to authenticated, service_role;

commit;
