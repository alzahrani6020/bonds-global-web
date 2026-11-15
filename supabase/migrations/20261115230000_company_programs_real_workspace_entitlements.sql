-- BONDS Company Programs: additive, fail-closed entitlements bound to REAL
-- existing BONDS CRM company workspaces. Does not replace CRM tables, users,
-- memberships, records or alter any existing RLS policy.
-- THIS MIGRATION DOES NOT GRANT ACCESS TO MAKKIN APIs.
begin;
create table if not exists public.company_program_entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
  program_key text not null check (program_key in (
    'crm','hr','real_estate','fleet','sales','purchasing','inventory',
    'finance','accounting','projects','governance'
  )),
  status text not null default 'pending' check (status in (
    'pending','trial','active','suspended','expired','cancelled'
  )),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  seats integer check (seats is null or seats >= 1),
  branches integer check (branches is null or branches >= 1),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,program_key),
  check (valid_until is null or valid_until > valid_from)
);
create index if not exists company_program_entitlements_workspace_idx
  on public.company_program_entitlements(workspace_id,status,program_key);
alter table public.company_program_entitlements enable row level security;
revoke all on public.company_program_entitlements from public,anon,authenticated;
grant select on public.company_program_entitlements to authenticated;
-- Uses the existing secure BONDS workspace membership function, NOT user input.
drop policy if exists company_program_entitlements_member_read on public.company_program_entitlements;
create policy company_program_entitlements_member_read
 on public.company_program_entitlements for select to authenticated
 using (crm_private.workspace_role(workspace_id) is not null);
-- No INSERT/UPDATE/DELETE grants to browser roles: only trusted billing
-- backend can activate, suspend, renew or revoke entitlements.
-- Changes are immutable audit history. This contains no customer secrets.
create table if not exists public.company_program_entitlement_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
  entitlement_id uuid not null references public.company_program_entitlements(id) on delete restrict,
  program_key text not null,
  action text not null check(action in ('INSERT','UPDATE','DELETE')),
  previous_status text,
  new_status text,
  changed_at timestamptz not null default now()
);
alter table public.company_program_entitlement_audit enable row level security;
revoke all on public.company_program_entitlement_audit from public,anon,authenticated;
grant select on public.company_program_entitlement_audit to authenticated;
drop policy if exists company_program_entitlement_audit_owner_read on public.company_program_entitlement_audit;
create policy company_program_entitlement_audit_owner_read
 on public.company_program_entitlement_audit for select to authenticated
 using (crm_private.workspace_role(workspace_id)='owner');
create or replace function crm_private.record_program_entitlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Program entitlements are revocable, not deletable';
  end if;
  insert into public.company_program_entitlement_audit
    (workspace_id,entitlement_id,program_key,action,previous_status,new_status)
  values
    (new.workspace_id,new.id,new.program_key,tg_op,
     case when tg_op='UPDATE' then old.status else null end,new.status);
  return new;
end
$$;
revoke all on function crm_private.record_program_entitlement() from public,anon,authenticated;
drop trigger if exists company_program_entitlements_audit_trg on public.company_program_entitlements;
create trigger company_program_entitlements_audit_trg
 after insert or update or delete on public.company_program_entitlements
 for each row execute function crm_private.record_program_entitlement();
-- A trigger fired AFTER DELETE cannot prevent deletion safely: enforce
-- preservation with a BEFORE DELETE trigger as well.
create or replace function crm_private.prevent_program_entitlement_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin raise exception 'Revoke program entitlement by status, never delete'; end $$;
revoke all on function crm_private.prevent_program_entitlement_delete() from public,anon,authenticated;
drop trigger if exists company_program_entitlements_no_delete_trg on public.company_program_entitlements;
create trigger company_program_entitlements_no_delete_trg
 before delete on public.company_program_entitlements
 for each row execute function crm_private.prevent_program_entitlement_delete();
commit;
