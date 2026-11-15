-- Additive CRM activities/tasks ledger for Bonds, modelled on Makkin SCC380.
-- Apply through reviewed Supabase migration workflow BEFORE deploying the new CRM API.
-- No changes to existing CRM tables or data. Browser roles are explicitly denied.
begin;
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete set null,
  client_id uuid references public.advisory_clients(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  activity_type text not null default 'task' check (activity_type in ('call','meeting','email','task','note','whatsapp','sms','visit')),
  subject text not null check (char_length(btrim(subject)) between 1 and 300),
  details text,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint crm_activities_completed_at_ck check (
    (status = 'completed' and completed_at is not null) or
    (status <> 'completed' and completed_at is null)
  )
);
create index if not exists crm_activities_status_schedule_idx on public.crm_activities(status,scheduled_at);
create index if not exists crm_activities_client_idx on public.crm_activities(client_id,created_at desc);
create index if not exists crm_activities_opp_idx on public.crm_activities(opportunity_id,created_at desc);
create index if not exists crm_activities_organization_idx on public.crm_activities(organization_id,created_at desc);
alter table public.crm_activities enable row level security;
revoke all on table public.crm_activities from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.crm_activities to service_role;
commit;
