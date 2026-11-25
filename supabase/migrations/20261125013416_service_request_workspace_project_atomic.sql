-- BONDS service request transaction and tenant references, applied to production on 2026-11-25.
alter table public.service_requests
 add column if not exists crm_workspace_id uuid references public.crm_app_workspaces(id) on delete restrict,
 add column if not exists linked_user_project_id uuid references public.user_projects(id) on delete restrict,
 add column if not exists linked_bonds_project_id uuid references public.bonds_projects(id) on delete restrict,
 add column if not exists linked_project_id uuid references public.projects(id) on delete restrict;

CREATE OR REPLACE FUNCTION public.create_service_request_atomic(p_user_id uuid, p_request jsonb, p_values jsonb DEFAULT '{}'::jsonb, p_form_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_company uuid; v_project uuid; v_user_project uuid; v_bonds_project uuid; v_project_id uuid;
 v_request public.service_requests%rowtype; v_member boolean; v_meta jsonb;
begin
 if p_user_id is null or jsonb_typeof(p_request) <> 'object' or jsonb_typeof(p_values) <> 'object' then
  raise exception 'INVALID_REQUEST' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_values))>250 then
  raise exception 'TOO_MANY_FIELDS' using errcode='22023';
 end if;
 if nullif(p_request->>'crm_workspace_id','') is not null then
  v_company := (p_request->>'crm_workspace_id')::uuid;
  select exists(select 1 from public.crm_app_workspaces w where w.id=v_company and
   (w.owner_user_id=p_user_id or exists(select 1 from public.crm_app_members m where m.workspace_id=w.id and m.member_user_id=p_user_id and m.active=true)))
   into v_member;
  if not v_member then raise exception 'WORKSPACE_ACCESS_DENIED' using errcode='42501'; end if;
 end if;
 v_meta := coalesce(p_request->'metadata','{}'::jsonb);
 if jsonb_typeof(v_meta)<>'object' then raise exception 'INVALID_METADATA' using errcode='22023'; end if;
 if nullif(v_meta->>'project_id','') is not null then
  v_project := (v_meta->>'project_id')::uuid;
  select id into v_user_project from public.user_projects where id=v_project and user_id=p_user_id;
  select id into v_bonds_project from public.bonds_projects where id=v_project and user_id=p_user_id;
  select id into v_project_id from public.projects where id=v_project and user_id=p_user_id;
  if v_user_project is null and v_bonds_project is null and v_project_id is null then
   raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';
  end if;
 end if;
 v_meta := v_meta || jsonb_build_object(
  'workspace_scope',case when v_company is null then 'personal' else 'company' end,
  'workspace_owner_user_id',p_user_id,
  'crm_workspace_id',v_company
 );
 insert into public.service_requests(
  user_id,client_id,service_id,package_id,goal_code,country_code,region_code,region_name,
  locality_code,locality_name,geo_place_id,geo_snapshot,sector_code,canonical_activity_id,
  status,submitted_at,metadata,crm_workspace_id,
  linked_user_project_id,linked_bonds_project_id,linked_project_id
 ) values (
  p_user_id,nullif(p_request->>'client_id','')::uuid,(p_request->>'service_id')::uuid,
  nullif(p_request->>'package_id','')::uuid,nullif(p_request->>'goal_code',''),
  nullif(p_request->>'country_code',''),nullif(p_request->>'region_code',''),
  nullif(p_request->>'region_name',''),nullif(p_request->>'locality_code',''),
  nullif(p_request->>'locality_name',''),nullif(p_request->>'geo_place_id','')::uuid,
  coalesce(p_request->'geo_snapshot','{}'::jsonb),nullif(p_request->>'sector_code',''),
  nullif(p_request->>'canonical_activity_id','')::uuid,
  'submitted',now(),v_meta,v_company,v_user_project,v_bonds_project,v_project_id
 ) returning * into v_request;
 insert into public.service_request_values(service_request_id,field_key,value,form_version)
 select v_request.id,key,value,p_form_version from jsonb_each(p_values);
 return jsonb_build_object('id',v_request.id,'request_reference',v_request.request_reference,
  'status',v_request.status,'created_at',v_request.created_at,'crm_workspace_id',v_company,
  'workspace_scope',case when v_company is null then 'personal' else 'company' end);
end
$function$
;
revoke all on function public.create_service_request_atomic(uuid,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.create_service_request_atomic(uuid,jsonb,jsonb,integer) to service_role;
