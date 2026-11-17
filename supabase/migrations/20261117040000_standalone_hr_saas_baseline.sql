-- Independent human resources SaaS, in the company-programs dashboard.
-- CRM tables and CRM workspace subscriptions are deliberately not referenced.
-- Catalog and owner-specific entitlement grants are independent from CRM data.
-- Payment or admin provisioning must issue these grants server-side; browser has no INSERT.
create table public.company_program_entitlements (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 product_code text not null check(product_code in ('crm','hr','finance','suite')),
 status text not null check(status in ('active','trial','expired','cancelled','suspended')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 unique(owner_user_id,product_code),
 check(ends_at is null or ends_at>starts_at)
);
alter table public.company_program_entitlements enable row level security;
create policy company_program_entitlements_owner_read
 on public.company_program_entitlements for select to authenticated
 using(owner_user_id=(select auth.uid()));
revoke all on public.company_program_entitlements from public,anon,authenticated;
grant select on public.company_program_entitlements to authenticated;
-- Only privileged server-side billing/provisioning actors may INSERT/UPDATE entitlements.
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
-- HR access requires an active entitlement; owning a CRM workspace does not grant HR access.
create policy hr_saas_workspace_select on public.hr_saas_workspaces for select to authenticated using((owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_workspace_insert on public.hr_saas_workspaces for insert to authenticated with check((owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_workspace_update on public.hr_saas_workspaces for update to authenticated using((owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
))) with check((owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_employee_select on public.hr_saas_employees for select to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_employee_insert on public.hr_saas_employees for insert to authenticated with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_employee_update on public.hr_saas_employees for update to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
))) with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_record_select on public.hr_saas_records for select to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_record_insert on public.hr_saas_records for insert to authenticated with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
create policy hr_saas_record_update on public.hr_saas_records for update to authenticated using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
))) with check(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
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
 using(exists(select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and exists (
 select 1 from public.company_program_entitlements e
 where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
 and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now())
)));
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

-- Isolated commercial ledger for company programs only (not legacy Bonds Pro).
-- A signature-verified provider webhook must invoke the service-role-only RPC.
-- No customer browser can create an entitlement, replay an event or fake a charge.
create table public.company_program_billing_events (
 provider_event_id text primary key check(length(provider_event_id) between 8 and 200),
 provider_subscription_id text not null,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 product_code text not null check(product_code in ('crm','hr','finance','suite')),
 provider_status text not null,
 event_created timestamptz not null,
 processed_at timestamptz not null default now()
);
alter table public.company_program_billing_events enable row level security;
revoke all on public.company_program_billing_events from public,anon,authenticated;
create table public.company_program_subscriptions (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 product_code text not null check(product_code in ('crm','hr','finance','suite')),
 provider text not null default 'stripe' check(provider='stripe'),
 provider_subscription_id text not null unique,
 provider_price_id text not null,
 provider_status text not null,
 last_event_created timestamptz not null,
 period_end timestamptz,
 updated_at timestamptz not null default now(),
 unique(owner_user_id,product_code)
);
alter table public.company_program_subscriptions enable row level security;
create policy company_program_subscription_owner_select on public.company_program_subscriptions
 for select to authenticated using(owner_user_id=(select auth.uid()));
revoke all on public.company_program_subscriptions from public,anon,authenticated;
grant select on public.company_program_subscriptions to authenticated;
create function public.company_program_apply_stripe_event(
 p_event_id text,p_subscription_id text,p_owner_user_id uuid,p_product_code text,
 p_price_id text,p_provider_status text,p_event_created timestamptz,p_period_end timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare
 prior public.company_program_subscriptions%rowtype;
 mapped_status text;
 inserted_event text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]+$'
   or length(p_event_id)>200 or p_subscription_id is null or
   p_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
   or p_owner_user_id is null or p_product_code not in ('crm','hr','finance','suite')
   or p_price_id is null or p_price_id !~ '^price_[A-Za-z0-9_]+$'
   or p_provider_status not in ('active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')
   or p_event_created is null or p_event_created>now()+interval '5 minutes' then
  raise exception 'Invalid verified Stripe event' using errcode='22023';
 end if;
 if p_provider_status in ('active','trialing') and (p_period_end is null or p_period_end<=now()) then
  raise exception 'Active entitlement requires a future provider period' using errcode='22023';
 end if;
 insert into public.company_program_billing_events(
   provider_event_id,provider_subscription_id,owner_user_id,product_code,provider_status,event_created)
 values(p_event_id,p_subscription_id,p_owner_user_id,p_product_code,p_provider_status,p_event_created)
 on conflict(provider_event_id) do nothing returning provider_event_id into inserted_event;
 if inserted_event is null then return 'duplicate'; end if;
 select * into prior from public.company_program_subscriptions
  where owner_user_id=p_owner_user_id and product_code=p_product_code for update;
 if found then
  if prior.provider_subscription_id<>p_subscription_id then
   raise exception 'Subscription replacement requires reconciliation' using errcode='23514';
  end if;
  if p_event_created<=prior.last_event_created then return 'stale'; end if;
  if prior.provider_price_id<>p_price_id then
   raise exception 'Subscription plan change requires reconciliation' using errcode='23514';
  end if;
 end if;
 mapped_status:=case
  when p_provider_status='active' then 'active'
  when p_provider_status='trialing' then 'trial'
  when p_provider_status='canceled' then 'cancelled'
  when p_provider_status='incomplete_expired' then 'expired'
  else 'suspended' end;
 insert into public.company_program_subscriptions(
   owner_user_id,product_code,provider_subscription_id,provider_price_id,provider_status,
   last_event_created,period_end)
 values(p_owner_user_id,p_product_code,p_subscription_id,p_price_id,p_provider_status,p_event_created,p_period_end)
 on conflict(owner_user_id,product_code) do update set
  provider_status=excluded.provider_status,
  last_event_created=excluded.last_event_created,
  period_end=excluded.period_end,updated_at=now();
 insert into public.company_program_entitlements(owner_user_id,product_code,status,starts_at,ends_at)
 values(p_owner_user_id,p_product_code,mapped_status,now(),
  case when mapped_status in ('active','trial') then p_period_end else null end)
 on conflict(owner_user_id,product_code) do update set status=excluded.status,
  ends_at=excluded.ends_at;
 return 'applied';
end $$;
revoke all on function public.company_program_apply_stripe_event(
 text,text,uuid,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.company_program_apply_stripe_event(
 text,text,uuid,text,text,text,timestamptz,timestamptz) to service_role;

-- Stripe invoice evidence is separate from subscription authorization.
-- Invoice rows are available only to the owning company customer.
create table public.company_program_invoices (
 provider_invoice_id text primary key check(provider_invoice_id ~ '^in_[A-Za-z0-9_]+$'),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 product_code text not null check(product_code in ('crm','hr','finance','suite')),
 provider_subscription_id text not null references public.company_program_subscriptions(provider_subscription_id) on delete restrict,
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 amount_due_minor bigint not null check(amount_due_minor>=0),
 amount_paid_minor bigint not null check(amount_paid_minor>=0),
 provider_status text not null check(provider_status in ('draft','open','paid','uncollectible','void')),
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.company_program_invoices enable row level security;
create policy company_program_invoice_owner_read on public.company_program_invoices
 for select to authenticated using(owner_user_id=(select auth.uid()));
revoke all on public.company_program_invoices from public,anon,authenticated;
grant select on public.company_program_invoices to authenticated;
create function public.company_program_record_stripe_invoice(
 p_invoice_id text,p_owner_user_id uuid,p_product_code text,p_subscription_id text,
 p_currency text,p_amount_due_minor bigint,p_amount_paid_minor bigint,
 p_status text,p_paid_at timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare
 old_invoice public.company_program_invoices%rowtype;
begin
 if p_invoice_id is null or p_invoice_id !~ '^in_[A-Za-z0-9_]+$'
   or p_owner_user_id is null or p_product_code not in ('crm','hr','finance','suite')
   or p_subscription_id is null or p_currency !~ '^[A-Z]{3}$'
   or p_amount_due_minor<0 or p_amount_paid_minor<0
   or p_status not in ('draft','open','paid','uncollectible','void') then
  raise exception 'Invalid verified Stripe invoice' using errcode='22023';
 end if;
 if not exists(select 1 from public.company_program_subscriptions s
    where s.owner_user_id=p_owner_user_id and s.product_code=p_product_code
      and s.provider_subscription_id=p_subscription_id) then
  raise exception 'Invoice subscription mismatch' using errcode='23514';
 end if;
 select * into old_invoice from public.company_program_invoices
  where provider_invoice_id=p_invoice_id for update;
 if found then
  if old_invoice.owner_user_id<>p_owner_user_id or old_invoice.product_code<>p_product_code
    or old_invoice.provider_subscription_id<>p_subscription_id or old_invoice.currency<>p_currency then
   raise exception 'Invoice identity cannot change' using errcode='23514';
  end if;
  if old_invoice.provider_status='paid' and p_status<>'paid' then
   raise exception 'Paid invoice cannot be reverted' using errcode='23514';
  end if;
 end if;
 insert into public.company_program_invoices(
  provider_invoice_id,owner_user_id,product_code,provider_subscription_id,
  currency,amount_due_minor,amount_paid_minor,provider_status,paid_at)
 values(p_invoice_id,p_owner_user_id,p_product_code,p_subscription_id,
  p_currency,p_amount_due_minor,p_amount_paid_minor,p_status,p_paid_at)
 on conflict(provider_invoice_id) do update set
  amount_due_minor=excluded.amount_due_minor,amount_paid_minor=excluded.amount_paid_minor,
  provider_status=excluded.provider_status,paid_at=excluded.paid_at,updated_at=now();
 return 'recorded';
end $$;
revoke all on function public.company_program_record_stripe_invoice(
 text,uuid,text,text,text,bigint,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.company_program_record_stripe_invoice(
 text,uuid,text,text,text,bigint,bigint,text,timestamptz) to service_role;
