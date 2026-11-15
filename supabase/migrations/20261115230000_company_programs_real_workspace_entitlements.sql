-- BONDS Company Programs: REAL workspace adapters, not fake/new company accounts.
-- Existing BONDS has BOTH companies/company_members and CRM app workspaces.
-- The registry links either authoritative source without altering either table.
-- NEVER auto-provision subscriptions, migrate customer records or create accounts.
begin;
create table if not exists public.company_program_workspaces (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('crm','company')),
 crm_workspace_id uuid unique references public.crm_app_workspaces(id) on delete restrict,
 company_id uuid unique references public.companies(id) on delete restrict,
 created_at timestamptz not null default now(),
 check ((kind='crm' and crm_workspace_id is not null and company_id is null)
     or (kind='company' and company_id is not null and crm_workspace_id is null))
);
alter table public.company_program_workspaces enable row level security;
revoke all on public.company_program_workspaces from public,anon,authenticated;
grant select,insert on public.company_program_workspaces to service_role;
-- Only server-side authorization after verified Supabase session, workspace
-- ownership/membership and active company state can read this registry.

create table if not exists public.company_program_entitlements (
 id uuid primary key default gen_random_uuid(),
 workspace_link_id uuid not null references public.company_program_workspaces(id) on delete restrict,
 program_key text not null check(program_key in (
  'crm','hr','real_estate','fleet','sales','purchasing','inventory',
  'finance','accounting','projects','governance'
 )),
 status text not null default 'pending' check(status in (
  'pending','trial','active','suspended','expired','cancelled'
 )),
 valid_from timestamptz not null default now(),
 valid_until timestamptz,
 seats integer check(seats is null or seats>=1),
 branches integer check(branches is null or branches>=1),
 limits jsonb not null default '{}'::jsonb check(jsonb_typeof(limits)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_link_id,program_key),
 check(valid_until is null or valid_until>valid_from)
);
create index if not exists company_program_entitlements_workspace_idx
 on public.company_program_entitlements(workspace_link_id,status,program_key);
alter table public.company_program_entitlements enable row level security;
revoke all on public.company_program_entitlements from public,anon,authenticated;
grant select,insert,update on public.company_program_entitlements to service_role;
-- Paid entitlements cannot be self-assigned by owner or employee via browser.

create table if not exists public.company_program_entitlement_audit (
 id bigint generated always as identity primary key,
 workspace_link_id uuid not null references public.company_program_workspaces(id) on delete restrict,
 entitlement_id uuid not null references public.company_program_entitlements(id) on delete restrict,
 program_key text not null,
 action text not null check(action in ('INSERT','UPDATE')),
 previous_status text,
 new_status text,
 changed_at timestamptz not null default now()
);
alter table public.company_program_entitlement_audit enable row level security;
revoke all on public.company_program_entitlement_audit from public,anon,authenticated;
grant select on public.company_program_entitlement_audit to service_role;
create or replace function crm_private.record_program_entitlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare prior_status text;
begin
 if tg_op='UPDATE' then
   prior_status := old.status;
 else
   prior_status := null;
 end if;
 insert into public.company_program_entitlement_audit
  (workspace_link_id,entitlement_id,program_key,action,previous_status,new_status)
 values(new.workspace_link_id,new.id,new.program_key,tg_op,
        prior_status,new.status);
 return new;
end
$$;
revoke all on function crm_private.record_program_entitlement() from public,anon,authenticated;
drop trigger if exists company_program_entitlements_audit_trg on public.company_program_entitlements;
create trigger company_program_entitlements_audit_trg
 after insert or update on public.company_program_entitlements
 for each row execute function crm_private.record_program_entitlement();
create or replace function crm_private.prevent_program_entitlement_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin raise exception 'Revoke program entitlement by status, never delete'; end $$;
revoke all on function crm_private.prevent_program_entitlement_delete() from public,anon,authenticated;
drop trigger if exists company_program_entitlements_no_delete_trg on public.company_program_entitlements;
create trigger company_program_entitlements_no_delete_trg
 before delete on public.company_program_entitlements
 for each row execute function crm_private.prevent_program_entitlement_delete();
commit;
