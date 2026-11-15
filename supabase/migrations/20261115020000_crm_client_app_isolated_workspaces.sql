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
-- Prevent repeated CSV imports from creating multiple contacts for the same email.
-- Case-insensitive uniqueness is scoped to the company workspace only.
create unique index crm_app_contacts_workspace_email_unique
 on public.crm_app_contacts(workspace_id,lower(btrim(email)))
 where email is not null and btrim(email)<>'';
create index crm_app_deals_workspace_idx on public.crm_app_deals(workspace_id,updated_at desc);
create index crm_app_activities_workspace_idx on public.crm_app_activities(workspace_id,status,scheduled_at);
create index crm_app_renewals_workspace_idx on public.crm_app_renewals(workspace_id,renewal_date);
create index crm_app_success_workspace_idx on public.crm_app_success(workspace_id,updated_at desc);
create index crm_app_workspaces_owner_idx on public.crm_app_workspaces(owner_user_id);
-- Workspace ownership is verified by PostgreSQL, never by client-provided role or metadata.
alter table public.crm_app_workspaces enable row level security;
create policy crm_app_workspaces_read on public.crm_app_workspaces for select to authenticated
 using ((select auth.uid()) is not null and owner_user_id=(select auth.uid()));
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
  execute format('create policy %I on public.%I for select to authenticated using (workspace_id in (select id from public.crm_app_workspaces where owner_user_id=(select auth.uid())))',t||'_read',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (workspace_id in (select id from public.crm_app_workspaces where owner_user_id=(select auth.uid())))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (workspace_id in (select id from public.crm_app_workspaces where owner_user_id=(select auth.uid()))) with check (workspace_id in (select id from public.crm_app_workspaces where owner_user_id=(select auth.uid())))',t||'_update',t);
 end loop;
end $$;
