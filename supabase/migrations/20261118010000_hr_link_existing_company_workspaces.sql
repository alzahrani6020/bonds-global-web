-- Additive link: HR keeps its own IDs and program entitlement but shares the
-- existing CRM company workspace identity. Never match companies by name.
-- The existing CRM primary key is sufficient for referential integrity.
-- Keep all new constraints and ownership checks on HR-owned objects only.
alter table public.hr_saas_workspaces
 add column crm_workspace_id uuid;
alter table public.hr_saas_workspaces
 add constraint hr_saas_crm_workspace_unique unique(crm_workspace_id),
 add constraint hr_saas_crm_workspace_fk
  foreign key(crm_workspace_id)
  references public.crm_app_workspaces(id) on delete restrict;
-- Enforce same-owner linkage for privileged inserts as well as RLS clients.
create function hr_saas_private.assert_crm_workspace_owner()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.crm_workspace_id is null or not exists (
  select 1 from public.crm_app_workspaces c
  where c.id=new.crm_workspace_id and c.owner_user_id=new.owner_user_id
 ) then
  raise exception 'HR workspace must reference a CRM workspace owned by the same user'
   using errcode='23514';
 end if;
 return new;
end $$;
create trigger hr_saas_workspace_owner_guard
 before insert on public.hr_saas_workspaces for each row
 execute function hr_saas_private.assert_crm_workspace_owner();
-- Do not silently migrate preexisting HR records to an unrelated CRM tenant.
-- Browser creation must reference a real workspace owned by the same account.
drop policy hr_saas_workspace_insert on public.hr_saas_workspaces;
create policy hr_saas_workspace_insert on public.hr_saas_workspaces
 for insert to authenticated with check (
  owner_user_id=(select auth.uid()) and crm_workspace_id is not null
  and exists (select 1 from public.crm_app_workspaces c
   where c.id=crm_workspace_id and c.owner_user_id=(select auth.uid()))
  and exists (select 1 from public.company_program_entitlements e
   where e.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite')
   and e.status in ('active','trial') and e.starts_at<=now()
   and (e.ends_at is null or e.ends_at>now()))
 );
create function hr_saas_private.prevent_workspace_reassignment()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_user_id<>old.owner_user_id or
   new.crm_workspace_id is distinct from old.crm_workspace_id or new.id<>old.id then
  raise exception 'HR workspace identity cannot be reassigned' using errcode='23514';
 end if;
 return new;
end $$;
create trigger hr_saas_workspace_identity_guard
 before update on public.hr_saas_workspaces for each row
 execute function hr_saas_private.prevent_workspace_reassignment();
