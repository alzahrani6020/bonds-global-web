-- Enforce tenant ownership on direct inserts and updates as well as RPC calls.
CREATE OR REPLACE FUNCTION public.enforce_service_request_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.crm_workspace_id is not null and not exists (
  select 1 from public.crm_app_workspaces w
  where w.id=new.crm_workspace_id and
   (w.owner_user_id=new.user_id or exists (
     select 1 from public.crm_app_members m where m.workspace_id=w.id and m.member_user_id=new.user_id and m.active
   ))
 ) then
  raise exception 'WORKSPACE_ACCESS_DENIED' using errcode='42501';
 end if;
 if new.linked_user_project_id is not null and not exists (
  select 1 from public.user_projects p where p.id=new.linked_user_project_id and p.user_id=new.user_id
 ) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501'; end if;
 if new.linked_bonds_project_id is not null and not exists (
  select 1 from public.bonds_projects p where p.id=new.linked_bonds_project_id and p.user_id=new.user_id
 ) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501'; end if;
 if new.linked_project_id is not null and not exists (
  select 1 from public.projects p where p.id=new.linked_project_id and p.user_id=new.user_id
 ) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501'; end if;
 return new;
end $function$
;
revoke all on function public.enforce_service_request_links() from public,anon,authenticated;
drop trigger if exists service_request_links_guard on public.service_requests;
create trigger service_request_links_guard before insert or update of user_id,crm_workspace_id,linked_user_project_id,linked_bonds_project_id,linked_project_id on public.service_requests for each row execute function public.enforce_service_request_links();
