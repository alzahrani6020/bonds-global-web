-- Audited HR salary run preparation: no payment execution or statutory reporting.
create table public.hr_saas_payroll_periods (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 payroll_year integer not null check(payroll_year between 2000 and 2200),
 payroll_month integer not null check(payroll_month between 1 and 12),
 status text not null default 'draft' check(status in ('draft','reviewed','approved')),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),unique(workspace_id,payroll_year,payroll_month),
 check((status='approved')=(approved_at is not null))
);
create table public.hr_saas_payroll_lines (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 period_id uuid not null, employee_id uuid not null,
 base_salary numeric(18,2) not null check(base_salary>=0),
 allowance_total numeric(18,2) not null default 0 check(allowance_total>=0),
 deduction_total numeric(18,2) not null default 0 check(deduction_total>=0),
 net_salary numeric(18,2) generated always as (base_salary + allowance_total - deduction_total) stored,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),unique(workspace_id,period_id,employee_id),
 foreign key(workspace_id,period_id) references public.hr_saas_payroll_periods(workspace_id,id) on delete restrict,
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(deduction_total<=base_salary+allowance_total)
);
create index hr_saas_payroll_periods_idx on public.hr_saas_payroll_periods(workspace_id,payroll_year desc,payroll_month desc);
create index hr_saas_payroll_lines_idx on public.hr_saas_payroll_lines(workspace_id,period_id);
-- No line changes once period advances to review. To revise, review must return to draft.
create function hr_saas_private.payroll_line_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p_status text;
begin
 select p.status into p_status from public.hr_saas_payroll_periods p
  where p.workspace_id=new.workspace_id and p.id=new.period_id for update;
 if p_status is distinct from 'draft' then
  raise exception 'Payroll period is not editable' using errcode='23514';
 end if;
 if tg_op='UPDATE' and
  (new.workspace_id<>old.workspace_id or new.period_id<>old.period_id or new.employee_id<>old.employee_id) then
  raise exception 'Payroll line identity is immutable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.payroll_line_guard() from public,anon,authenticated;
create trigger hr_saas_payroll_line_guard before insert or update on public.hr_saas_payroll_lines
 for each row execute function hr_saas_private.payroll_line_guard();
create function hr_saas_private.payroll_period_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.workspace_id<>old.workspace_id or new.payroll_year<>old.payroll_year or new.payroll_month<>old.payroll_month then
  raise exception 'Payroll period identity is immutable' using errcode='23514';
 end if;
 if old.status='approved' then
  raise exception 'Approved payroll cannot be amended' using errcode='23514';
 end if;
 if old.status='draft' and new.status not in ('draft','reviewed') then
  raise exception 'Payroll must be reviewed before approval' using errcode='23514';
 end if;
 if old.status='reviewed' and new.status not in ('draft','reviewed','approved') then
  raise exception 'Invalid payroll transition' using errcode='23514';
 end if;
 if new.status='approved' then
  if not exists(select 1 from public.hr_saas_payroll_lines l
   where l.workspace_id=new.workspace_id and l.period_id=new.id) then
    raise exception 'Empty payroll run cannot be approved' using errcode='23514';
  end if;
  new.approved_at=coalesce(new.approved_at,now());
 else
  new.approved_at=null;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.payroll_period_guard() from public,anon,authenticated;
create trigger hr_saas_payroll_period_guard before update on public.hr_saas_payroll_periods
 for each row execute function hr_saas_private.payroll_period_guard();
alter table public.hr_saas_payroll_periods enable row level security;
create policy hr_saas_payroll_periods_select on public.hr_saas_payroll_periods for select to authenticated using (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
create policy hr_saas_payroll_periods_insert on public.hr_saas_payroll_periods for insert to authenticated with check (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
create policy hr_saas_payroll_periods_update on public.hr_saas_payroll_periods for update to authenticated using (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
)) with check (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
revoke all on public.hr_saas_payroll_periods from public,anon,authenticated;
grant select,insert,update on public.hr_saas_payroll_periods to authenticated;
create trigger hr_saas_payroll_periods_audit after insert or update on public.hr_saas_payroll_periods for each row execute function hr_saas_private.audit_change();
alter table public.hr_saas_payroll_lines enable row level security;
create policy hr_saas_payroll_lines_select on public.hr_saas_payroll_lines for select to authenticated using (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
create policy hr_saas_payroll_lines_insert on public.hr_saas_payroll_lines for insert to authenticated with check (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
create policy hr_saas_payroll_lines_update on public.hr_saas_payroll_lines for update to authenticated using (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
)) with check (exists (
 select 1 from public.hr_saas_workspaces w
 join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
 where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial')
 and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
));
revoke all on public.hr_saas_payroll_lines from public,anon,authenticated;
grant select,insert,update on public.hr_saas_payroll_lines to authenticated;
create trigger hr_saas_payroll_lines_audit after insert or update on public.hr_saas_payroll_lines for each row execute function hr_saas_private.audit_change();
