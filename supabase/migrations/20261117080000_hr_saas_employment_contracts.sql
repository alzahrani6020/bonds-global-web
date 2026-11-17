-- Standalone employment contracts. Records are not signed documents or statutory determinations.
create table public.hr_saas_employment_contracts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 contract_number text not null check(length(btrim(contract_number)) between 1 and 80),
 contract_type text not null check(contract_type in ('fixed_term','indefinite','part_time','temporary','other')),
 status text not null default 'draft' check(status in ('draft','active','expired','terminated','cancelled')),
 start_date date not null,
 end_date date,
 probation_end_date date,
 base_salary numeric(18,2) not null check(base_salary>=0),
 currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 termination_reason text,
 notes text,
 activated_at timestamptz,
 terminated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,contract_number),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(end_date is null or end_date>=start_date),
 check(probation_end_date is null or (probation_end_date>=start_date and (end_date is null or probation_end_date<=end_date))),
 check((status='active' or status in ('expired','terminated')) or activated_at is null),
 check(status<>'terminated' or terminated_at is not null)
);
create index hr_saas_contract_employee_idx on public.hr_saas_employment_contracts(workspace_id,employee_id,start_date desc);
-- Serialize contract activation per employee and reject overlapping live contracts.
create function hr_saas_private.contract_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.status<>'draft' then
  raise exception 'Contract must start as draft' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id
     or new.contract_number<>old.contract_number then
   raise exception 'Contract identity cannot change' using errcode='23514';
  end if;
  if old.status in ('terminated','cancelled','expired') and new is distinct from old then
   raise exception 'Closed contract is immutable' using errcode='23514';
  end if;
  if old.status='draft' and new.status not in ('draft','active','cancelled') then
   raise exception 'Contract requires activation' using errcode='23514';
  end if;
  if old.status='active' and new.status not in ('active','expired','terminated') then
   raise exception 'Invalid contract transition' using errcode='23514';
  end if;
 end if;
 if new.status='active' then
  perform 1 from public.hr_saas_employees e
   where e.workspace_id=new.workspace_id and e.id=new.employee_id for update;
  if exists (
   select 1 from public.hr_saas_employment_contracts c where c.workspace_id=new.workspace_id
    and c.employee_id=new.employee_id and c.id<>new.id and c.status='active'
    and c.start_date<=coalesce(new.end_date,'infinity'::date)
    and new.start_date<=coalesce(c.end_date,'infinity'::date)
  ) then raise exception 'Overlapping active contracts' using errcode='23514'; end if;
  new.activated_at=coalesce(new.activated_at,now());
 else
  if tg_op='UPDATE' and old.status='active' and new.status in ('expired','terminated') then
   new.terminated_at=case when new.status='terminated' then now() else null end;
  end if;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.contract_guard() from public,anon,authenticated;
create trigger hr_saas_contract_guard before insert or update on public.hr_saas_employment_contracts
 for each row execute function hr_saas_private.contract_guard();
alter table public.hr_saas_employment_contracts enable row level security;
create policy hr_saas_contract_select on public.hr_saas_employment_contracts for select to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_contract_insert on public.hr_saas_employment_contracts for insert to authenticated with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_contract_update on public.hr_saas_employment_contracts for update to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))) with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
revoke all on public.hr_saas_employment_contracts from public,anon,authenticated;
grant select,insert,update on public.hr_saas_employment_contracts to authenticated;
create trigger hr_saas_contract_audit after insert or update on public.hr_saas_employment_contracts
 for each row execute function hr_saas_private.audit_change();
