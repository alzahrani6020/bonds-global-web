-- HR SaaS self-service: owner-provisioned identities, least privilege, approved-only manager decisions.
-- No privilege change to salary, payroll, contract or employee-detail tables.
create table public.hr_saas_memberships (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 employee_id uuid not null,
 role text not null check (role in ('employee','hr_manager')),
 status text not null default 'active' check(status in ('active','revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,user_id),
 unique(workspace_id,employee_id),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict
);
create index hr_saas_membership_account_idx on public.hr_saas_memberships(user_id,status);
create function hr_saas_private.membership_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.workspace_id<>old.workspace_id or new.user_id<>old.user_id or new.employee_id<>old.employee_id then
   raise exception 'Membership identity cannot change' using errcode='23514';
  end if;
  if old.status='revoked' then
   raise exception 'Revoked membership cannot be reactivated' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.membership_guard() from public,anon,authenticated;
create trigger hr_saas_membership_guard before update on public.hr_saas_memberships
 for each row execute function hr_saas_private.membership_guard();
-- Private authorization check: only owner or active member of a licensed
-- workspace. It reveals one boolean, never license, payroll or employee data.
create function hr_saas_private.has_active_access(target_workspace uuid)
returns boolean language sql stable security definer set search_path='' as $
 select (select auth.uid()) is not null and exists(
  select 1 from public.hr_saas_workspaces w
  join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
  where w.id=target_workspace
   and e.product_code in ('hr','suite') and e.status in ('active','trial')
   and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
   and (w.owner_user_id=(select auth.uid()) or exists(
    select 1 from public.hr_saas_memberships m
    where m.workspace_id=w.id and m.user_id=(select auth.uid()) and m.status='active'
   ))
 );
$;
revoke all on function hr_saas_private.has_active_access(uuid) from public,anon,authenticated;
grant usage on schema hr_saas_private to authenticated;
grant execute on function hr_saas_private.has_active_access(uuid) to authenticated;
alter table public.hr_saas_memberships enable row level security;
create policy hr_membership_owner_or_self_select on public.hr_saas_memberships
 for select to authenticated using ((exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or (user_id=(select auth.uid()) and status='active')) and hr_saas_private.has_active_access(workspace_id));
create policy hr_membership_owner_insert on public.hr_saas_memberships
 for insert to authenticated with check (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) and hr_saas_private.has_active_access(workspace_id));
create policy hr_membership_owner_update on public.hr_saas_memberships
 for update to authenticated using (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) and hr_saas_private.has_active_access(workspace_id))
 with check (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) and hr_saas_private.has_active_access(workspace_id));
revoke all on public.hr_saas_memberships from public,anon,authenticated;
grant select,insert,update on public.hr_saas_memberships to authenticated;
create trigger hr_saas_membership_audit after insert or update on public.hr_saas_memberships
 for each row execute function hr_saas_private.audit_change();

-- Self-service requests have no amounts, identity details, payslips or documents.
create table public.hr_saas_employee_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 requested_by uuid not null references auth.users(id) on delete restrict,
 request_type text not null check(request_type in ('leave','attendance_correction','certificate','training','other')),
 subject text not null check(length(btrim(subject)) between 1 and 180),
 description text not null check(length(btrim(description)) between 1 and 2000),
 from_date date, to_date date,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decision_note text,
 decided_by uuid references auth.users(id) on delete restrict,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(to_date is null or from_date is null or to_date>=from_date),
 check((status='pending')=(decided_at is null and decided_by is null))
);
create index hr_saas_requests_queue_idx on public.hr_saas_employee_requests(workspace_id,status,created_at desc);
create index hr_saas_requests_owner_idx on public.hr_saas_employee_requests(requested_by,created_at desc);
create function hr_saas_private.request_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.requested_by<>(select auth.uid()) or new.status<>'pending'
   or new.decided_by is not null or new.decided_at is not null
   or new.decision_note is not null then
   raise exception 'Only pending self-service requests may be created' using errcode='23514';
  end if;
 else
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id
   or new.requested_by<>old.requested_by or new.request_type<>old.request_type
   or new.subject<>old.subject or new.description<>old.description
   or new.from_date is distinct from old.from_date
   or new.to_date is distinct from old.to_date then
   raise exception 'Request identity and content cannot change after submission' using errcode='23514';
  end if;
  if old.status<>'pending' then
   raise exception 'Decided request is immutable' using errcode='23514';
  end if;
  if new.status not in ('approved','rejected') then
   raise exception 'Request must be approved or rejected' using errcode='23514';
  end if;
  new.decided_by=(select auth.uid());
  new.decided_at=now();
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.request_guard() from public,anon,authenticated;
create trigger hr_saas_request_guard before insert or update on public.hr_saas_employee_requests
 for each row execute function hr_saas_private.request_guard();
alter table public.hr_saas_employee_requests enable row level security;
create policy hr_request_owner_member_manager_select on public.hr_saas_employee_requests
 for select to authenticated
 using (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager') or
 (requested_by=(select auth.uid()) and exists (select 1 from public.hr_saas_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.employee_id=employee_id and m.status='active'))));
create policy hr_request_self_insert on public.hr_saas_employee_requests
 for insert to authenticated
 with check (hr_saas_private.has_active_access(workspace_id) and requested_by=(select auth.uid())
 and exists (select 1 from public.hr_saas_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.employee_id=employee_id and m.status='active') and status='pending'
 and decided_by is null and decided_at is null);
create policy hr_request_owner_manager_update on public.hr_saas_employee_requests
 for update to authenticated
 using (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager')))
 with check (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager')));
revoke all on public.hr_saas_employee_requests from public,anon,authenticated;
grant select,insert,update on public.hr_saas_employee_requests to authenticated;
create trigger hr_saas_request_audit after insert or update on public.hr_saas_employee_requests
 for each row execute function hr_saas_private.audit_change();
