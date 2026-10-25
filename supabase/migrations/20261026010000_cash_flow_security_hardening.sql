begin;

-- Harden legacy client cash-flow trigger functions against search_path hijacking.
alter function public.touch_cash_flow_updated_at()
  set search_path = public;

alter function public.normalize_cash_flow_report()
  set search_path = public;

revoke all on function public.touch_cash_flow_updated_at()
  from public, anon, authenticated;
revoke all on function public.normalize_cash_flow_report()
  from public, anon, authenticated;

-- The authenticated accounting boundary must derive both identity and role
-- from the JWT. service_role uses server-mediated accounting surfaces instead.
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
    and coalesce((select auth.role()), '') = 'authenticated'
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

revoke all on function public.accounting_user_can_access_entity(uuid)
  from public, anon, service_role;
grant execute on function public.accounting_user_can_access_entity(uuid)
  to authenticated;

revoke all on function public.accounting_user_ledger_balances(uuid,date,date)
  from public, anon, service_role;
grant execute on function public.accounting_user_ledger_balances(uuid,date,date)
  to authenticated;

revoke all on function public.accounting_user_cash_balance(uuid,date)
  from public, anon, service_role;
grant execute on function public.accounting_user_cash_balance(uuid,date)
  to authenticated;

revoke all on function public.accounting_user_cash_flow_movements(uuid,date,date)
  from public, anon, service_role;
grant execute on function public.accounting_user_cash_flow_movements(uuid,date,date)
  to authenticated;

commit;
