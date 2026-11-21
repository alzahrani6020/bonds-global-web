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
-- Reject multi-level hierarchy cycles; same-row cycles are also blocked by CHECK.
create function hr_saas_private.department_hierarchy_guard() returns trigger
 language plpgsql security invoker set search_path='' as $
declare cycle_found boolean;
begin
 if new.parent_department_id is not null then
  with recursive ancestors(id,parent_department_id) as (
   select d.id,d.parent_department_id from public.hr_saas_departments d
    where d.workspace_id=new.workspace_id and d.id=new.parent_department_id
   union all
   select d.id,d.parent_department_id from public.hr_saas_departments d
    join ancestors a on a.parent_department_id=d.id
    where d.workspace_id=new.workspace_id
  )
  select exists(select 1 from ancestors where id=new.id) into cycle_found;
  if cycle_found then
   raise exception 'Department hierarchy cycle' using errcode='23514'; end if;
 end if;
 return new;
end $;
revoke all on function hr_saas_private.department_hierarchy_guard() from public,anon,authenticated;
create trigger hr_saas_department_hierarchy_guard before insert or update of parent_department_id
 on public.hr_saas_departments for each row execute function hr_saas_private.department_hierarchy_guard();
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
  if old.review_status in ('submitted','rejected') and new.review_status<>'draft' and
     (new.clock_in,new.clock_out,new.attendance_status,new.note)
     is distinct from (old.clock_in,old.clock_out,old.attendance_status,old.note) then
   raise exception 'Reviewed attendance values are locked until returned to draft' using errcode='23514'; end if;
  if old.review_status='rejected' and new.review_status='rejected' and new is distinct from old then
   raise exception 'Rejected attendance cannot be edited before reopening' using errcode='23514'; end if;
  if old.review_status='submitted' and new.review_status='submitted' and new is distinct from old then
   raise exception 'Submitted attendance cannot be edited before returning to draft' using errcode='23514'; end if;
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

-- Approved attendance is immutable. Corrections have a separate audited lifecycle
-- and an invoker-security read model; the original source row is never rewritten.
create table public.hr_saas_attendance_corrections (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 attendance_id uuid not null,
 requested_status text not null check(requested_status in ('present','absent','leave','remote','holiday')),
 requested_clock_in timestamptz,
 requested_clock_out timestamptz,
 reason text not null check(length(btrim(reason)) between 5 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_by uuid not null references auth.users(id) on delete restrict,
 decided_by uuid references auth.users(id) on delete restrict,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,attendance_id)
  references public.hr_saas_attendance(workspace_id,id) on delete restrict,
 check(requested_clock_out is null or requested_clock_in is not null),
 check(requested_clock_out is null or requested_clock_out>requested_clock_in),
 check(requested_status not in ('absent','leave','holiday') or
       (requested_clock_in is null and requested_clock_out is null)),
 check((status in ('approved','rejected'))=(decided_at is not null))
);
create unique index hr_saas_corrections_one_pending on public.hr_saas_attendance_corrections(workspace_id,attendance_id)
 where status='pending';
create index hr_saas_corrections_timeline on public.hr_saas_attendance_corrections(workspace_id,attendance_id,decided_at desc);
create function hr_saas_private.attendance_correction_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare source_date date; source_state text;
begin
 if tg_op='INSERT' then
  if new.status<>'pending' or new.decided_at is not null or new.decided_by is not null then
   raise exception 'Correction must start pending' using errcode='23514'; end if;
  new.requested_by=(select auth.uid());
  if new.requested_by is null then
   raise exception 'Authenticated requester required' using errcode='42501'; end if;
 else
  if new.workspace_id<>old.workspace_id or new.attendance_id<>old.attendance_id
     or new.requested_by<>old.requested_by then
   raise exception 'Correction identity is immutable' using errcode='23514'; end if;
  if old.status in ('approved','rejected') and new is distinct from old then
   raise exception 'Final attendance correction is immutable' using errcode='23514'; end if;
  if old.status='pending' and new.status not in ('pending','approved','rejected') then
   raise exception 'Invalid correction transition' using errcode='23514'; end if;
  if old.status='pending' and new.status in ('approved','rejected') and
   (new.requested_status,new.requested_clock_in,new.requested_clock_out,new.reason)
   is distinct from (old.requested_status,old.requested_clock_in,old.requested_clock_out,old.reason) then
    raise exception 'Decision cannot alter correction proposal' using errcode='23514'; end if;
 end if;
 select a.work_date,a.review_status into source_date,source_state
 from public.hr_saas_attendance a where a.workspace_id=new.workspace_id and a.id=new.attendance_id for update;
 if source_state is distinct from 'approved' then
  raise exception 'Correction requires approved attendance' using errcode='23514'; end if;
 if new.requested_clock_in is not null and
    (new.requested_clock_in at time zone 'Asia/Riyadh')::date<>source_date then
  raise exception 'Corrected time does not match work date' using errcode='23514'; end if;
 if new.status in ('approved','rejected') then
  new.decided_by=(select auth.uid());
  new.decided_at=now();
 else
  new.decided_by=null;new.decided_at=null;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.attendance_correction_guard() from public,anon,authenticated;
create trigger hr_saas_attendance_correction_guard before insert or update
 on public.hr_saas_attendance_corrections for each row execute function hr_saas_private.attendance_correction_guard();
alter table public.hr_saas_attendance_corrections enable row level security;
create policy hr_attendance_corrections_read on public.hr_saas_attendance_corrections for select to authenticated using (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_attendance_corrections_add on public.hr_saas_attendance_corrections for insert to authenticated with check (
 exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e
 on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid())
 and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now()
 and (e.ends_at is null or e.ends_at>now()))
);
create policy hr_attendance_corrections_edit on public.hr_saas_attendance_corrections for update to authenticated using (
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
revoke all on public.hr_saas_attendance_corrections from public,anon,authenticated;
grant select,insert,update on public.hr_saas_attendance_corrections to authenticated;
create trigger hr_saas_attendance_corrections_audit after insert or update on public.hr_saas_attendance_corrections
 for each row execute function hr_saas_private.audit_change();
create view public.hr_saas_attendance_effective with (security_invoker=true) as
 select a.id,a.workspace_id,a.employee_id,a.work_date,a.review_status,
  case when c.id is null then a.attendance_status else c.requested_status end as attendance_status,
  case when c.id is null then a.clock_in else c.requested_clock_in end as clock_in,
  case when c.id is null then a.clock_out else c.requested_clock_out end as clock_out,
  c.id as approved_correction_id,a.note,a.created_at,a.updated_at
 from public.hr_saas_attendance a
 left join lateral (
  select c.id,c.requested_status,c.requested_clock_in,c.requested_clock_out
  from public.hr_saas_attendance_corrections c
  where c.workspace_id=a.workspace_id and c.attendance_id=a.id and c.status='approved'
  order by c.decided_at desc,c.id desc limit 1
 ) c on true;
revoke all on public.hr_saas_attendance_effective from public,anon,authenticated;
grant select on public.hr_saas_attendance_effective to authenticated;
