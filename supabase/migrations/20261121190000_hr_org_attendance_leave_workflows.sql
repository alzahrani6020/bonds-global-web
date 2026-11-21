-- Additive HR organization and workflow hardening; no existing data is deleted.
-- Deploy only after isolated restore and full migration acceptance.
create table public.hr_saas_departments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 department_code text not null check (length(btrim(department_code)) between 1 and 40),
 name text not null check (length(btrim(name)) between 1 and 180),
 parent_department_id uuid,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,department_code),
 foreign key(workspace_id,parent_department_id) references public.hr_saas_departments(workspace_id,id) on delete restrict,
 check(parent_department_id is null or parent_department_id<>id)
);
create table public.hr_saas_positions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 department_id uuid not null,
 position_code text not null check(length(btrim(position_code)) between 1 and 40),
 title text not null check(length(btrim(title)) between 1 and 180),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,position_code),
 foreign key(workspace_id,department_id) references public.hr_saas_departments(workspace_id,id) on delete restrict
);
alter table public.hr_saas_employees
 add column department_id uuid,
 add column position_id uuid,
 add constraint hr_saas_employees_department_fk foreign key(workspace_id,department_id)
 references public.hr_saas_departments(workspace_id,id) on delete restrict,
 add constraint hr_saas_employees_position_fk foreign key(workspace_id,position_id)
 references public.hr_saas_positions(workspace_id,id) on delete restrict;
create index hr_saas_departments_workspace_idx on public.hr_saas_departments(workspace_id,name);
create index hr_saas_positions_department_idx on public.hr_saas_positions(workspace_id,department_id);
create index hr_saas_employees_org_idx on public.hr_saas_employees(workspace_id,department_id,position_id);
create function hr_saas_private.employee_position_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.position_id is not null then
  if new.department_id is null or not exists (
   select 1 from public.hr_saas_positions p where p.id=new.position_id
   and p.workspace_id=new.workspace_id and p.department_id=new.department_id and p.is_active
  ) then raise exception 'Position must belong to the selected active department' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.employee_position_guard() from public,anon,authenticated;
create trigger hr_saas_employee_position_guard before insert or update of department_id,position_id,workspace_id
 on public.hr_saas_employees for each row execute function hr_saas_private.employee_position_guard();

-- Use the existing HR entitlement boundary for every new organization table.
alter table public.hr_saas_departments enable row level security;
alter table public.hr_saas_positions enable row level security;
create policy hr_departments_read on public.hr_saas_departments for select to authenticated using (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_departments_add on public.hr_saas_departments for insert to authenticated with check (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_departments_edit on public.hr_saas_departments for update to authenticated using (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
) with check (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_positions_read on public.hr_saas_positions for select to authenticated using (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_positions_add on public.hr_saas_positions for insert to authenticated with check (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_positions_edit on public.hr_saas_positions for update to authenticated using (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
) with check (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
revoke all on public.hr_saas_departments,public.hr_saas_positions from public,anon,authenticated;
grant select,insert,update on public.hr_saas_departments,public.hr_saas_positions to authenticated;
create trigger hr_saas_departments_audit after insert or update on public.hr_saas_departments
 for each row execute function hr_saas_private.audit_change();
create trigger hr_saas_positions_audit after insert or update on public.hr_saas_positions
 for each row execute function hr_saas_private.audit_change();

-- Attendance requires a draft -> submitted -> approved/rejected lifecycle.
alter table public.hr_saas_attendance
 add column review_status text not null default 'draft'
  check (review_status in ('draft','submitted','approved','rejected')),
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references auth.users(id) on delete restrict,
 add constraint hr_saas_attendance_review_consistency
  check ((review_status in ('approved','rejected'))=(reviewed_at is not null));
create function hr_saas_private.attendance_review_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.review_status<>'draft' or new.reviewed_at is not null or new.reviewed_by is not null then
   raise exception 'Attendance must begin as draft' using errcode='23514'; end if;
 elsif tg_op='UPDATE' then
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id or new.work_date<>old.work_date then
   raise exception 'Attendance identity is immutable' using errcode='23514'; end if;
  if old.review_status='approved' and new is distinct from old then
   raise exception 'Approved attendance is immutable; use a separate correction request' using errcode='23514'; end if;
  if old.review_status='draft' and new.review_status not in ('draft','submitted') then
   raise exception 'Attendance requires submission' using errcode='23514'; end if;
  if old.review_status='submitted' and new.review_status not in ('submitted','approved','rejected','draft') then
   raise exception 'Invalid attendance decision' using errcode='23514'; end if;
  if old.review_status='rejected' and new.review_status not in ('rejected','draft') then
   raise exception 'Rejected attendance must return to draft' using errcode='23514'; end if;
  if old.review_status='submitted' and new.review_status in ('approved','rejected') then
   if (new.clock_in,new.clock_out,new.attendance_status,new.note)
      is distinct from (old.clock_in,old.clock_out,old.attendance_status,old.note) then
    raise exception 'Decision cannot silently alter attendance time' using errcode='23514'; end if;
  end if;
 end if;
 if new.review_status in ('approved','rejected') then
  new.reviewed_at=now();
  new.reviewed_by=(select auth.uid());
 else
  new.reviewed_at=null;new.reviewed_by=null;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.attendance_review_guard() from public,anon,authenticated;
create trigger hr_saas_attendance_review_guard before insert or update on public.hr_saas_attendance
 for each row execute function hr_saas_private.attendance_review_guard();

-- Final leave decisions must not be rewritten, including by direct API requests.
create function hr_saas_private.leave_decision_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'pending' or new.decided_at is not null then
   raise exception 'Leave must begin pending' using errcode='23514'; end if;
 elsif tg_op='UPDATE' then
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id then
   raise exception 'Leave identity is immutable' using errcode='23514'; end if;
  if old.status in ('approved','rejected','cancelled') and new is distinct from old then
   raise exception 'Final leave decision is immutable' using errcode='23514'; end if;
  if old.status='pending' and new.status not in ('pending','approved','rejected','cancelled') then
   raise exception 'Invalid leave transition' using errcode='23514'; end if;
  if old.status='pending' and new.status in ('approved','rejected') and
     (new.employee_id,new.leave_type,new.start_date,new.end_date,new.reason)
     is distinct from (old.employee_id,old.leave_type,old.start_date,old.end_date,old.reason) then
   raise exception 'Leave decision must not rewrite request details' using errcode='23514'; end if;
 end if;
 if new.status in ('approved','rejected') then
  new.decided_at=coalesce(new.decided_at,now());
 else
  new.decided_at=null;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.leave_decision_guard() from public,anon,authenticated;
create trigger hr_saas_leave_decision_guard before insert or update on public.hr_saas_leave_requests
 for each row execute function hr_saas_private.leave_decision_guard();
