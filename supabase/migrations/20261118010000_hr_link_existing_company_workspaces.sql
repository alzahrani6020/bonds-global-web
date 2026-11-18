-- Additive link: HR keeps its own IDs and program entitlement but shares the
-- existing CRM company workspace identity. Never match companies by name.
alter table public.crm_app_workspaces
 add constraint crm_app_workspaces_owner_id_key unique(owner_user_id,id);
alter table public.hr_saas_workspaces
 add column crm_workspace_id uuid;
alter table public.hr_saas_workspaces
 add constraint hr_saas_crm_workspace_unique unique(crm_workspace_id),
 add constraint hr_saas_crm_workspace_owner_fk
  foreign key(owner_user_id,crm_workspace_id)
  references public.crm_app_workspaces(owner_user_id,id) on delete restrict;
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
