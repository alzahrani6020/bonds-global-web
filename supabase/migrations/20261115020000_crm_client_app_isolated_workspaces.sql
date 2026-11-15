-- Client-facing CRM is isolated from Bonds internal admin CRM (crm_organizations et al).
-- One account initially owns one CRM app workspace; cross-owner references require matching workspace_id.
-- RESTRICT auth-user deletion to avoid cascading destruction of the company's CRM history.
-- Ownership transfer and employee memberships require a separately reviewed migration.
-- All writes occur as the signed-in user under RLS; no service_role is exposed to browsers.
create table public.crm_app_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id)
);
create table public.crm_app_companies (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 240),
 legal_name text, cr_number text, tax_number text, email text, phone text,
 city text, country text, sector text,
 status text not null default 'prospect' check(status in ('prospect','active','inactive','customer','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create table public.crm_app_contacts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 company_id uuid, name text not null check(char_length(btrim(name)) between 1 and 240),
 email text, phone text, role text, source text,
 status text not null default 'lead' check(status in ('lead','prospect','customer','active','inactive','archived')),
 is_decision_maker boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,company_id) references public.crm_app_companies(workspace_id,id),
 unique(workspace_id,id)
);
create table public.crm_app_deals (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 company_id uuid, contact_id uuid,
 title text not null check(char_length(btrim(title)) between 1 and 240),
 stage text not null default 'lead' check(stage in ('lead','qualified','proposal','negotiation','won','lost')),
 value_amount numeric(18,2) not null default 0 check(value_amount>=0),
 currency text not null default 'SAR' check(char_length(currency) between 3 and 8),
 probability integer not null default 10 check(probability between 0 and 100),
 expected_close_date date, next_action text, next_action_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,company_id) references public.crm_app_companies(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.crm_app_contacts(workspace_id,id),
 unique(workspace_id,id)
);
create table public.crm_app_activities (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 company_id uuid,contact_id uuid,deal_id uuid,
 subject text not null check(char_length(btrim(subject)) between 1 and 300),
 kind text not null default 'task' check(kind in ('task','call','meeting','email','note','whatsapp','sms','visit')),
 details text,
 status text not null default 'open' check(status in ('open','completed','cancelled')),
 scheduled_at timestamptz,completed_at timestamptz,deleted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,company_id) references public.crm_app_companies(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.crm_app_contacts(workspace_id,id),
 foreign key(workspace_id,deal_id) references public.crm_app_deals(workspace_id,id)
);
create table public.crm_app_renewals (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 company_id uuid,contact_id uuid,
 title text not null check(char_length(btrim(title)) between 1 and 240),
 renewal_date date not null,
 value_amount numeric(18,2) not null default 0 check(value_amount>=0),
 status text not null default 'upcoming' check(status in ('upcoming','contacted','negotiating','renewed','churned','cancelled')),
 risk_level text not null default 'low' check(risk_level in ('low','medium','high','critical')),
 notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,company_id) references public.crm_app_companies(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.crm_app_contacts(workspace_id,id)
);
create table public.crm_app_success (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 company_id uuid,contact_id uuid,
 health_score integer not null default 50 check(health_score between 0 and 100),
 risk_level text not null default 'low' check(risk_level in ('low','medium','high','critical')),
 lifecycle_stage text not null default 'onboarding' check(lifecycle_stage in ('onboarding','activated','adopting','healthy','at_risk','churned')),
 next_review_at timestamptz, success_plan text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,company_id) references public.crm_app_companies(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.crm_app_contacts(workspace_id,id)
);
-- Independent company-owned pipelines and configurable stages, matching Makkin.
create table public.crm_app_pipelines (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 160),
 description text,
 is_active boolean not null default true,
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,name)
);
create unique index crm_app_pipelines_one_default_idx
 on public.crm_app_pipelines(workspace_id) where is_default;
create table public.crm_app_pipeline_stages (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 pipeline_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 160),
 sort_order integer not null default 0 check(sort_order between 0 and 10000),
 probability integer not null default 10 check(probability between 0 and 100),
 is_won boolean not null default false,
 is_lost boolean not null default false,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(workspace_id,pipeline_id) references public.crm_app_pipelines(workspace_id,id),
 unique(workspace_id,id),
 unique(workspace_id,pipeline_id,id),
 check(not(is_won and is_lost))
);
alter table public.crm_app_deals
 add column pipeline_id uuid,
 add column pipeline_stage_id uuid,
 add constraint crm_app_deal_stage_requires_pipeline check(pipeline_stage_id is null or pipeline_id is not null),
 add constraint crm_app_deal_pipeline_fk
   foreign key(workspace_id,pipeline_id) references public.crm_app_pipelines(workspace_id,id),
 add constraint crm_app_deal_pipeline_stage_fk
   foreign key(workspace_id,pipeline_id,pipeline_stage_id)
   references public.crm_app_pipeline_stages(workspace_id,pipeline_id,id);
create index crm_app_pipelines_workspace_idx on public.crm_app_pipelines(workspace_id,is_active);
create index crm_app_pipeline_stages_pipeline_idx on public.crm_app_pipeline_stages(workspace_id,pipeline_id,sort_order);
create index crm_app_companies_workspace_idx on public.crm_app_companies(workspace_id,updated_at desc);
create index crm_app_contacts_workspace_idx on public.crm_app_contacts(workspace_id,updated_at desc);
-- Prevent exact repeated imports without prohibiting shared company inboxes.
-- Two different contacts may legitimately share one email address.
create unique index crm_app_contacts_workspace_identity_unique
 on public.crm_app_contacts(workspace_id,lower(btrim(name)),lower(btrim(email)))
 where email is not null and btrim(email)<>'';
create index crm_app_deals_workspace_idx on public.crm_app_deals(workspace_id,updated_at desc);
create index crm_app_activities_workspace_idx on public.crm_app_activities(workspace_id,status,scheduled_at);
create index crm_app_renewals_workspace_idx on public.crm_app_renewals(workspace_id,renewal_date);
create index crm_app_success_workspace_idx on public.crm_app_success(workspace_id,updated_at desc);
create index crm_app_workspaces_owner_idx on public.crm_app_workspaces(owner_user_id);
-- Internal authorization functions are outside the exposed public Data API schema.
-- Browser callers never get direct write permissions to private audit records.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon, authenticated;
grant usage on schema crm_private to authenticated;

create table public.crm_app_members (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete cascade,
 member_user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('admin','editor','viewer')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,member_user_id)
);
create index crm_app_members_user_idx on public.crm_app_members(member_user_id,workspace_id);

-- The SECURITY DEFINER lookup breaks the workspaces <-> memberships RLS cycle.
-- It uses the authoritative auth.uid() and does not trust user_metadata.
-- A missing/inactive membership returns NULL; the owner is implicit.
create function crm_private.workspace_role(target_workspace uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
 select case
  when (select auth.uid()) is null then null
  when exists (
   select 1 from public.crm_app_workspaces w
   where w.id=target_workspace and w.owner_user_id=(select auth.uid())
  ) then 'owner'
  else (
   select m.role from public.crm_app_members m
   where m.workspace_id=target_workspace
    and m.member_user_id=(select auth.uid()) and m.active=true
   limit 1
  )
 end
$$;
revoke all on function crm_private.workspace_role(uuid) from public, anon, authenticated;
grant execute on function crm_private.workspace_role(uuid) to authenticated;
-- Owner/admin/editor may edit records; viewers may read only.
create function crm_private.can_edit(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select coalesce(crm_private.workspace_role(target_workspace)
   in ('owner','admin','editor'),false)
$$;
revoke all on function crm_private.can_edit(uuid) from public, anon, authenticated;
grant execute on function crm_private.can_edit(uuid) to authenticated;

create table public.crm_app_audit (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
 actor_user_id uuid,
 entity text not null,
 entity_id uuid not null,
 action text not null check(action in ('INSERT','UPDATE')),
 changed_columns text[] not null,
 created_at timestamptz not null default now()
);
create index crm_app_audit_workspace_idx on public.crm_app_audit(workspace_id,created_at desc);
alter table public.crm_app_audit enable row level security;
revoke all on public.crm_app_audit from public, anon, authenticated;
grant select on public.crm_app_audit to authenticated;
create policy crm_app_audit_owner_read on public.crm_app_audit
 for select to authenticated
 using (crm_private.workspace_role(workspace_id)='owner');

-- The trigger writes only column names and event metadata, never PII values.
-- Users cannot insert/modify audit rows directly.
create function crm_private.record_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare fields text[];
begin
 if TG_OP='INSERT' then
  select array_agg(key order by key) into fields
    from jsonb_object_keys(to_jsonb(NEW)) as key;
 else
  select array_agg(n.key order by n.key) into fields
   from jsonb_each(to_jsonb(NEW)) as n(key,value)
   where n.value is distinct from to_jsonb(OLD)->n.key;
 end if;
 if TG_OP='INSERT' or coalesce(array_length(fields,1),0)>0 then
  insert into public.crm_app_audit(workspace_id,actor_user_id,entity,entity_id,action,changed_columns)
   values (NEW.workspace_id,(select auth.uid()),TG_TABLE_NAME,NEW.id,TG_OP,coalesce(fields,array[]::text[]));
 end if;
 return NEW;
end
$$;
revoke all on function crm_private.record_event() from public,anon,authenticated;

-- Workspace ownership is verified by PostgreSQL, never by client-provided role or metadata.
alter table public.crm_app_workspaces enable row level security;
create policy crm_app_workspaces_read on public.crm_app_workspaces for select to authenticated
 using ((select auth.uid()) is not null and (owner_user_id=(select auth.uid()) or crm_private.workspace_role(id) is not null));
create policy crm_app_workspaces_insert on public.crm_app_workspaces for insert to authenticated
 with check ((select auth.uid()) is not null and owner_user_id=(select auth.uid()));
create policy crm_app_workspaces_update on public.crm_app_workspaces for update to authenticated
 using ((select auth.uid()) is not null and owner_user_id=(select auth.uid()))
 with check ((select auth.uid()) is not null and owner_user_id=(select auth.uid()));
revoke all on public.crm_app_workspaces from PUBLIC,anon,authenticated;
grant select,insert,update on public.crm_app_workspaces to authenticated;
-- All child rows inherit access exclusively through the current user's owned workspace.
do $$
declare t text;
begin
 foreach t in array array['crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success','crm_app_pipelines','crm_app_pipeline_stages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from PUBLIC,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using (crm_private.workspace_role(workspace_id) is not null)',t||'_read',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (crm_private.can_edit(workspace_id))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (crm_private.can_edit(workspace_id)) with check (crm_private.can_edit(workspace_id))',t||'_update',t);
 end loop;
end $$;

-- Membership creation, revocation and role changes are reserved to the owner.
alter table public.crm_app_members enable row level security;
revoke all on public.crm_app_members from public,anon,authenticated;
grant select,insert,update on public.crm_app_members to authenticated;
create policy crm_app_members_read on public.crm_app_members for select to authenticated
 using (member_user_id=(select auth.uid()) or crm_private.workspace_role(workspace_id)='owner');
create policy crm_app_members_insert on public.crm_app_members for insert to authenticated
 with check (crm_private.workspace_role(workspace_id)='owner');
create policy crm_app_members_update on public.crm_app_members for update to authenticated
 using (crm_private.workspace_role(workspace_id)='owner')
 with check (crm_private.workspace_role(workspace_id)='owner');

-- Records and member-role changes are recorded in the private audit ledger.
do $$
declare t text;
begin
 foreach t in array array[
  'crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities',
  'crm_app_renewals','crm_app_success','crm_app_pipelines',
  'crm_app_pipeline_stages','crm_app_members'
 ] loop
  execute format('create trigger %I after insert or update on public.%I for each row execute function crm_private.record_event()',t||'_audit',t);
 end loop;
end $$;
