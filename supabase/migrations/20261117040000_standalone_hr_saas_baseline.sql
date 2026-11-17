-- Independent human resources SaaS, in the company-programs dashboard.
-- CRM tables and CRM workspace subscriptions are deliberately not referenced.
create table public.hr_saas_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 name text not null check (length(btrim(name)) between 1 and 180),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,id)
);
create table public.hr_saas_employees (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_number text not null check(length(btrim(employee_number)) between 1 and 60),
 full_name text not null check(length(btrim(full_name)) between 1 and 240),
 department text,job_title text,email text,phone text,
 hire_date date,termination_date date,
 employment_status text not null default 'active' check(employment_status in ('draft','active','on_leave','suspended','terminated')),
 basic_salary numeric(18,2) check(basic_salary>=0),
 salary_currency text not null default 'SAR' check(length(salary_currency) between 3 and 8),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,id),unique(workspace_id,employee_number),
 check(termination_date is null or hire_date is null or termination_date>=hire_date)
);
create index hr_saas_employees_workspace_idx on public.hr_saas_employees(workspace_id,employment_status);
create table public.hr_saas_records (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid,
 category text not null check(category in ('departments','recruitment','contracts','attendance','shifts',
 'leaves','leave_balances','payroll','payroll_runs','benefits','allowances','deductions','claims','loans',
 'settlements','performance','training','documents','employee_requests','assets','governance','lifecycle')),
 title text not null check(length(btrim(title)) between 1 and 240),
 status text not null default 'draft' check(length(btrim(status)) between 1 and 60),
 effective_date date,end_date date,amount numeric(18,2) check(amount>=0),
 currency text default 'SAR' check(length(currency) between 3 and 8),
 details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object' and pg_column_size(details)<=16384),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(end_date is null or effective_date is null or end_date>=effective_date),
 check(category in ('departments','recruitment','governance','payroll_runs') or employee_id is not null)
);
create index hr_saas_records_workspace_idx on public.hr_saas_records(workspace_id,category,created_at desc);
-- Owner-only initial security, no implicit CRM membership access.
alter table public.hr_saas_workspaces enable row level security;
alter table public.hr_saas_employees enable row level security;
alter table public.hr_saas_records enable row level security;
create policy hr_saas_workspace_select on public.hr_saas_workspaces for select to authenticated using(owner_user_id=(select auth.uid()));
create policy hr_saas_workspace_insert on public.hr_saas_workspaces for insert to authenticated with check(owner_user_id=(select auth.uid()));
create policy hr_saas_workspace_update on public.hr_saas_workspaces for update to authenticated using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
create policy hr_saas_employee_select on public.hr_saas_employees for select to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
create policy hr_saas_employee_insert on public.hr_saas_employees for insert to authenticated with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
create policy hr_saas_employee_update on public.hr_saas_employees for update to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
create policy hr_saas_record_select on public.hr_saas_records for select to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
create policy hr_saas_record_insert on public.hr_saas_records for insert to authenticated with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
create policy hr_saas_record_update on public.hr_saas_records for update to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
revoke all on public.hr_saas_workspaces,public.hr_saas_employees,public.hr_saas_records from public,anon,authenticated;
grant select,insert,update on public.hr_saas_workspaces,public.hr_saas_employees,public.hr_saas_records to authenticated;

create table public.hr_saas_audit (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 actor_user_id uuid,entity text not null,entity_id uuid not null,action text not null,
 changed_columns text[] not null default '{}',created_at timestamptz not null default now()
);
alter table public.hr_saas_audit enable row level security;
create policy hr_saas_audit_owner_select on public.hr_saas_audit for select to authenticated
 using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
revoke all on public.hr_saas_audit from public,anon,authenticated;
grant select on public.hr_saas_audit to authenticated;
create index hr_saas_audit_workspace_idx on public.hr_saas_audit(workspace_id,created_at desc);
create schema if not exists hr_saas_private;
create function hr_saas_private.audit_change() returns trigger
language plpgsql security definer set search_path=''
as $$
declare columns_changed text[];
begin
 if tg_op='INSERT' then
  select array_agg(key order by key) into columns_changed from jsonb_object_keys(to_jsonb(new)) as key;
 else
  select array_agg(x.key order by x.key) into columns_changed
   from jsonb_each(to_jsonb(new)) x(key,value) where x.value is distinct from to_jsonb(old)->x.key;
 end if;
 if tg_op='INSERT' or coalesce(array_length(columns_changed,1),0)>0 then
  insert into public.hr_saas_audit(workspace_id,actor_user_id,entity,entity_id,action,changed_columns)
   values(new.workspace_id,(select auth.uid()),tg_table_name,new.id,tg_op,coalesce(columns_changed,'{}'::text[]));
 end if;
 return new;
end
$$;
revoke all on function hr_saas_private.audit_change() from public,anon,authenticated;
create trigger hr_saas_employees_audit after insert or update on public.hr_saas_employees for each row execute function hr_saas_private.audit_change();
create trigger hr_saas_records_audit after insert or update on public.hr_saas_records for each row execute function hr_saas_private.audit_change();
