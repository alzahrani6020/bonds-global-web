begin;

create index if not exists idx_accounting_cash_accounts_created_by
  on public.accounting_cash_accounts(created_by)
  where created_by is not null;

create index if not exists idx_accounting_cash_flow_policies_created_by
  on public.accounting_cash_flow_policies(created_by)
  where created_by is not null;

create index if not exists idx_client_cash_flow_reports_client_id
  on public.client_cash_flow_reports(client_id)
  where client_id is not null;

drop policy if exists cash_flow_select_own on public.client_cash_flow_reports;
create policy cash_flow_select_own
  on public.client_cash_flow_reports
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists cash_flow_insert_own on public.client_cash_flow_reports;
create policy cash_flow_insert_own
  on public.client_cash_flow_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists cash_flow_update_own on public.client_cash_flow_reports;
create policy cash_flow_update_own
  on public.client_cash_flow_reports
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (
    user_id = (select auth.uid())
    and status in ('draft','submitted')
  );

commit;
