-- Leave balances are explicit, auditable entries; no implicit legal accrual rule.
-- Positive and negative adjustments must be approved; approval is irreversible.
create table public.hr_saas_leave_ledger (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 entry_reference text not null check(length(btrim(entry_reference)) between 1 and 80),
 leave_type text not null check(leave_type in ('annual','sick','unpaid','maternity','paternity','emergency','bereavement','study','other')),
 effective_date date not null,
 days_delta numeric(9,2) not null check(days_delta<>0 and abs(days_delta)<=365),
 reason text not null check(length(btrim(reason)) between 1 and 500),
 status text not null default 'draft' check(status in ('draft','approved','cancelled')),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,entry_reference),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check((status='approved')=(approved_at is not null))
);
create index hr_saas_leave_ledger_emp_idx on public.hr_saas_leave_ledger(workspace_id,employee_id,leave_type,effective_date);
create function hr_saas_private.leave_ledger_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'draft' then raise exception 'Leave entry must start as draft' using errcode='23514';end if;
  new.approved_at=null;
 else
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id or new.entry_reference<>old.entry_reference then
   raise exception 'Leave ledger identity is immutable' using errcode='23514';
  end if;
  if old.status in ('approved','cancelled') and new is distinct from old then
   raise exception 'Finalized leave entry is immutable' using errcode='23514';
  end if;
  if old.status='draft' and new.status not in ('draft','approved','cancelled') then
   raise exception 'Invalid leave ledger transition' using errcode='23514';
  end if;
  new.approved_at=case when new.status='approved' then coalesce(old.approved_at,now()) else null end;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.leave_ledger_guard() from public,anon,authenticated;
create trigger hr_saas_leave_ledger_guard before insert or update on public.hr_saas_leave_ledger
 for each row execute function hr_saas_private.leave_ledger_guard();
alter table public.hr_saas_leave_ledger enable row level security;
create policy hr_saas_leave_ledger_select on public.hr_saas_leave_ledger for select to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_leave_ledger_insert on public.hr_saas_leave_ledger for insert to authenticated with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_leave_ledger_update on public.hr_saas_leave_ledger for update to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))) with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
revoke all on public.hr_saas_leave_ledger from public,anon,authenticated;
grant select,insert,update on public.hr_saas_leave_ledger to authenticated;
create trigger hr_saas_leave_ledger_audit after insert or update on public.hr_saas_leave_ledger
 for each row execute function hr_saas_private.audit_change();
-- Security-invoker view uses the caller's RLS and includes only approved entries.
create view public.hr_saas_leave_balance_summary with (security_invoker=true) as
 select workspace_id,employee_id,leave_type,sum(days_delta)::numeric(12,2) as days_balance
 from public.hr_saas_leave_ledger where status='approved'
 group by workspace_id,employee_id,leave_type;
revoke all on public.hr_saas_leave_balance_summary from public,anon,authenticated;
grant select on public.hr_saas_leave_balance_summary to authenticated;
