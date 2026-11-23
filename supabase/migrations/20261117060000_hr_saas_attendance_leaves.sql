-- Add operational attendance and leave requests to independent HR workspaces.
-- No existing HR/CRM tables or rows are changed. All queries require HR entitlement.
-- Salary and leave balances are not automatically calculated or paid.
create table public.hr_saas_attendance (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 employee_id uuid not null,
 work_date date not null,
 clock_in timestamptz,
 clock_out timestamptz,
 attendance_status text not null default 'present'
  check (attendance_status in ('present','absent','leave','remote','holiday')),
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,employee_id,work_date),
 foreign key(workspace_id,employee_id)
  references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(clock_out is null or clock_in is not null),
 check(clock_out is null or clock_out>clock_in),
 check(attendance_status not in ('absent','leave','holiday') or (clock_in is null and clock_out is null)),
 check(clock_in is null or (clock_in at time zone 'Asia/Riyadh')::date=work_date)
);
create index hr_saas_attendance_workspace_date_idx on public.hr_saas_attendance(workspace_id,work_date desc);

create table public.hr_saas_leave_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 employee_id uuid not null,
 leave_type text not null check(leave_type in
   ('annual','sick','unpaid','maternity','paternity','emergency','bereavement','study','other')),
 start_date date not null,
 end_date date not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 reason text,
 decision_note text,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,employee_id)
  references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check(end_date>=start_date),
 check((status in ('approved','rejected'))=(decided_at is not null))
);
create index hr_saas_leave_workspace_idx on public.hr_saas_leave_requests(workspace_id,employee_id,start_date);

-- Serialize approvals for a given employee; prevents concurrent overlapping approved requests.
create function hr_saas_private.validate_leave() returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
 if new.status='approved' then
  perform 1 from public.hr_saas_employees e
   where e.workspace_id=new.workspace_id and e.id=new.employee_id for update;
  if exists (
   select 1 from public.hr_saas_leave_requests l
   where l.workspace_id=new.workspace_id and l.employee_id=new.employee_id
    and l.status='approved' and l.id<>new.id
    and l.start_date<=new.end_date and l.end_date>=new.start_date
  ) then
   raise exception 'Overlapping approved leave' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.validate_leave() from public,anon,authenticated;
create trigger hr_saas_validate_leave before insert or update
 on public.hr_saas_leave_requests for each row execute function hr_saas_private.validate_leave();

alter table public.hr_saas_attendance enable row level security;
alter table public.hr_saas_leave_requests enable row level security;
-- Reuse the existing owner/entitlement boundary exactly; never trust client-supplied role.
create policy hr_saas_attendance_select on public.hr_saas_attendance
 for select to authenticated using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
create policy hr_saas_attendance_insert on public.hr_saas_attendance
 for insert to authenticated with check (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
create policy hr_saas_attendance_update on public.hr_saas_attendance
 for update to authenticated
 using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 )
 with check (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
create policy hr_saas_leave_select on public.hr_saas_leave_requests
 for select to authenticated using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
create policy hr_saas_leave_insert on public.hr_saas_leave_requests
 for insert to authenticated with check (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
create policy hr_saas_leave_update on public.hr_saas_leave_requests
 for update to authenticated
 using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 )
 with check (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid())
    and exists(select 1 from public.company_program_entitlements e
     where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
      and e.status in ('active','trial') and e.starts_at<=now()
      and (e.ends_at is null or e.ends_at>now())))
 );
revoke all on public.hr_saas_attendance,public.hr_saas_leave_requests from public,anon,authenticated;
grant select,insert,update on public.hr_saas_attendance,public.hr_saas_leave_requests to authenticated;
create trigger hr_saas_attendance_audit after insert or update on public.hr_saas_attendance
 for each row execute function hr_saas_private.audit_change();
create trigger hr_saas_leave_audit after insert or update on public.hr_saas_leave_requests
 for each row execute function hr_saas_private.audit_change();
