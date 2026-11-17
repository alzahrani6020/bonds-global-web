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
returns boolean language sql stable security definer set search_path='' as $$
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
$$;
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
 using (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=hr_saas_employee_requests.workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager') or
 (requested_by=(select auth.uid()) and exists (select 1 from public.hr_saas_memberships m where m.workspace_id=hr_saas_employee_requests.workspace_id and m.user_id=(select auth.uid()) and m.employee_id=hr_saas_employee_requests.employee_id and m.status='active'))));
create policy hr_request_self_insert on public.hr_saas_employee_requests
 for insert to authenticated
 with check (hr_saas_private.has_active_access(workspace_id) and requested_by=(select auth.uid())
 and exists (select 1 from public.hr_saas_memberships m where m.workspace_id=hr_saas_employee_requests.workspace_id and m.user_id=(select auth.uid()) and m.employee_id=hr_saas_employee_requests.employee_id and m.status='active') and status='pending'
 and decided_by is null and decided_at is null);
create policy hr_request_owner_manager_update on public.hr_saas_employee_requests
 for update to authenticated
 using (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=hr_saas_employee_requests.workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager')))
 with check (hr_saas_private.has_active_access(workspace_id) and (exists (select 1 from public.hr_saas_workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())) or exists (select 1 from public.hr_saas_memberships m where m.workspace_id=hr_saas_employee_requests.workspace_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='hr_manager')));
revoke all on public.hr_saas_employee_requests from public,anon,authenticated;
grant select,insert,update on public.hr_saas_employee_requests to authenticated;
create trigger hr_saas_request_audit after insert or update on public.hr_saas_employee_requests
 for each row execute function hr_saas_private.audit_change();

-- Owner-issued HR invitations. No email-based membership claims from the browser.
-- Pending tokens are visible only to the owning account; redemption requires the
-- authenticated invitee's email to have been verified by Supabase Auth.
create table public.hr_saas_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 invited_email text not null check (length(btrim(invited_email)) between 5 and 320),
 role text not null check(role in ('employee','hr_manager')),
 token uuid not null unique default gen_random_uuid(),
 created_by uuid not null references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','accepted')),
 expires_at timestamptz not null default (now()+interval '7 days'),
 created_at timestamptz not null default now(),
 accepted_by uuid references auth.users(id) on delete restrict,
 accepted_at timestamptz,
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check ((status='pending' and accepted_by is null and accepted_at is null)
     or (status='accepted' and accepted_by is not null and accepted_at is not null))
);
create index hr_saas_invitations_owner_idx on public.hr_saas_invitations(workspace_id,status,created_at desc);
alter table public.hr_saas_invitations enable row level security;
create policy hr_invite_owner_select on public.hr_saas_invitations
 for select to authenticated using (
  created_by=(select auth.uid())
  and exists (select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id));
create policy hr_invite_owner_insert on public.hr_saas_invitations
 for insert to authenticated with check (
  created_by=(select auth.uid()) and status='pending'
  and accepted_by is null and accepted_at is null
  and expires_at>now() and expires_at<=now()+interval '7 days'
  and invited_email=lower(btrim(invited_email))
  and exists (select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id));
revoke all on public.hr_saas_invitations from public,anon,authenticated;
grant select on public.hr_saas_invitations to authenticated;
-- Column-specific grants prevent clients from picking a predictable token or
-- setting an already-accepted invite. No direct update or deletion privilege.
grant insert (workspace_id,employee_id,invited_email,role,created_by)
 on public.hr_saas_invitations to authenticated;
create trigger hr_saas_invitations_audit after insert or update on public.hr_saas_invitations
 for each row execute function hr_saas_private.audit_change();

create function public.hr_saas_accept_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 invite public.hr_saas_invitations%rowtype;
 actor_id uuid := (select auth.uid());
 verified_email text;
 new_membership_id uuid;
begin
 if actor_id is null or invite_token is null then
  raise exception 'Invitation cannot be accepted' using errcode='42501';
 end if;
 select lower(btrim(u.email)) into verified_email from auth.users u
  where u.id=actor_id and u.email_confirmed_at is not null;
 if verified_email is null then
  raise exception 'Verified email required' using errcode='42501';
 end if;
 select * into invite from public.hr_saas_invitations i
  where i.token=invite_token for update;
 if not found or invite.status<>'pending' or invite.expires_at<=now()
    or invite.invited_email<>verified_email then
  raise exception 'Invitation cannot be accepted' using errcode='42501';
 end if;
 if not exists (
  select 1 from public.hr_saas_workspaces w
  join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id
  where w.id=invite.workspace_id
    and e.product_code in ('hr','suite') and e.status in ('active','trial')
    and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
 ) then
  raise exception 'Invitation cannot be accepted' using errcode='42501';
 end if;
 insert into public.hr_saas_memberships(workspace_id,user_id,employee_id,role,status)
  values(invite.workspace_id,actor_id,invite.employee_id,invite.role,'active')
  returning id into new_membership_id;
 update public.hr_saas_invitations set status='accepted',
  accepted_by=actor_id,accepted_at=now() where id=invite.id;
 return new_membership_id;
end $$;
revoke all on function public.hr_saas_accept_invitation(uuid) from public,anon,authenticated;
grant execute on function public.hr_saas_accept_invitation(uuid) to authenticated;

-- Effective-dated, company-reviewed policy inputs for draft HR calculations.
-- No statutory rate is guessed. Approved means approved by the company owner,
-- NOT a government attestation or authorization to issue payroll.
create table public.hr_saas_rule_sets (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 jurisdiction text not null check(jurisdiction ~ '^[A-Z]{2}$'),
 effective_from date not null,
 effective_to date,
 annual_leave_days numeric(8,4) not null check(annual_leave_days between 0 and 366),
 accrual_year_days integer not null check(accrual_year_days between 1 and 366),
 service_tiers jsonb not null check(jsonb_typeof(service_tiers)='array' and pg_column_size(service_tiers)<=16384),
 status text not null default 'draft' check(status in ('draft','approved')),
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,jurisdiction,effective_from),
 check(effective_to is null or effective_to>=effective_from),
 check((status='draft' and approved_by is null and approved_at is null)
   or (status='approved' and approved_by is not null and approved_at is not null))
);
create index hr_saas_rule_sets_active_idx on public.hr_saas_rule_sets(workspace_id,jurisdiction,effective_from desc);
create function hr_saas_private.rule_set_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'draft' or new.created_by<>(select auth.uid()) then
   raise exception 'New HR rules must be owner-created drafts' using errcode='23514';
  end if;
 else
  if old.status='approved' then
   raise exception 'Approved policy rules are immutable' using errcode='23514';
  end if;
  if new.workspace_id<>old.workspace_id or new.jurisdiction<>old.jurisdiction
    or new.created_by<>old.created_by or new.effective_from<>old.effective_from then
   raise exception 'Policy identity cannot be reassigned' using errcode='23514';
  end if;
  if new.status='approved' then
   new.approved_by=(select auth.uid());new.approved_at=now();
  end if;
 end if;
 if new.status='approved' and exists(
  select 1 from public.hr_saas_rule_sets p
  where p.workspace_id=new.workspace_id and p.jurisdiction=new.jurisdiction
   and p.status='approved' and p.id<>new.id
   and daterange(p.effective_from,p.effective_to,'[]') &&
      daterange(new.effective_from,new.effective_to,'[]')
 ) then
  raise exception 'Overlapping approved HR policies are not allowed' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.rule_set_guard() from public,anon,authenticated;
create trigger hr_saas_rule_set_guard before insert or update on public.hr_saas_rule_sets
 for each row execute function hr_saas_private.rule_set_guard();
alter table public.hr_saas_rule_sets enable row level security;
create policy hr_policy_owner_select on public.hr_saas_rule_sets
 for select to authenticated using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id));
create policy hr_policy_owner_insert on public.hr_saas_rule_sets
 for insert to authenticated with check(
  created_by=(select auth.uid()) and status='draft'
  and exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id));
create policy hr_policy_owner_update on public.hr_saas_rule_sets
 for update to authenticated using (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id))
 with check (
  exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id));
revoke all on public.hr_saas_rule_sets from public,anon,authenticated;
grant select,insert,update on public.hr_saas_rule_sets to authenticated;
create trigger hr_saas_rule_set_audit after insert or update on public.hr_saas_rule_sets
 for each row execute function hr_saas_private.audit_change();

create table public.hr_saas_calculation_drafts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 policy_id uuid not null,
 kind text not null check(kind in ('leave_accrual','end_of_service')),
 jurisdiction text not null check(jurisdiction ~ '^[A-Z]{2}$'),
 inputs jsonb not null check(jsonb_typeof(inputs)='object' and pg_column_size(inputs)<=16384),
 result jsonb not null check(jsonb_typeof(result)='object' and pg_column_size(result)<=16384),
 status text not null default 'draft' check(status='draft'),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 foreign key(workspace_id,policy_id) references public.hr_saas_rule_sets(workspace_id,id) on delete restrict
);
alter table public.hr_saas_calculation_drafts enable row level security;
create policy hr_calculation_owner_select on public.hr_saas_calculation_drafts
 for select to authenticated using(
  created_by=(select auth.uid()) and hr_saas_private.has_active_access(workspace_id));
create policy hr_calculation_owner_insert on public.hr_saas_calculation_drafts
 for insert to authenticated with check(
  created_by=(select auth.uid()) and status='draft'
  and exists(select 1 from public.hr_saas_workspaces w
   where w.id=workspace_id and w.owner_user_id=(select auth.uid()))
  and hr_saas_private.has_active_access(workspace_id)
  and exists(select 1 from public.hr_saas_rule_sets p
    where p.id=policy_id and p.workspace_id=workspace_id and p.status='approved'
      and p.jurisdiction=jurisdiction));
revoke all on public.hr_saas_calculation_drafts from public,anon,authenticated;
grant select,insert on public.hr_saas_calculation_drafts to authenticated;
create trigger hr_saas_calculation_audit after insert on public.hr_saas_calculation_drafts
 for each row execute function hr_saas_private.audit_change();
