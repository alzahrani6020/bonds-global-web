begin;

create or replace function public.accounting_ledger_balances(
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
security invoker
set search_path = public
as $$
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.accounting_entities
    where id = p_accounting_entity_id
      and status = 'active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'ACCOUNTING_REPORT_DATE_RANGE_INVALID';
  end if;

  return query
  select
    a.code,
    a.name,
    a.account_type,
    coalesce(sum(l.debit),0)::numeric as debit,
    coalesce(sum(l.credit),0)::numeric as credit
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

revoke all on function public.accounting_ledger_balances(uuid,date,date) from public;
revoke all on function public.accounting_ledger_balances(uuid,date,date) from anon, authenticated;
grant execute on function public.accounting_ledger_balances(uuid,date,date) to service_role;

commit;
