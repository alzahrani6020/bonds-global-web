-- BONDS correspondence campaigns: additive schema; no changes to existing issued documents.
-- All access is through authenticated, tenant-scoped server APIs using the service role.
create table if not exists public.correspondence_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  kind text not null check (kind in ('investment','partnership','institutional','customer','supplier','other')),
  status text not null default 'draft' check (status in ('draft','review','approved','running','paused','completed','cancelled')),
  description text not null default '',
  subject_template text not null default '',
  body_template text not null default '',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index if not exists correspondence_campaigns_company_idx
  on public.correspondence_campaigns (workspace_id, created_at desc);
create table if not exists public.correspondence_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  workspace_id uuid not null,
  organization text not null default '',
  name text not null default '',
  email text not null check (char_length(email) between 5 and 320),
  contact_id uuid,
  document_id uuid references public.correspondence_documents(id) on delete restrict,
  draft_document_id uuid references public.correspondence_documents(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','prepared','issued','queued','accepted','delivered','failed','replied','excluded')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, workspace_id) references public.correspondence_campaigns(id,workspace_id) on delete restrict
);
create unique index if not exists correspondence_campaign_recipients_unique
  on public.correspondence_campaign_recipients (campaign_id, lower(trim(email)));
create unique index if not exists correspondence_documents_campaign_recipient_unique
  on public.correspondence_documents ((workspace_context->>'campaign_recipient_id'))
  where workspace_context ? 'campaign_recipient_id';
create unique index if not exists correspondence_campaign_recipients_draft_unique
  on public.correspondence_campaign_recipients (draft_document_id) where draft_document_id is not null;
create unique index if not exists correspondence_campaign_recipients_document_unique
  on public.correspondence_campaign_recipients (document_id) where document_id is not null;
create index if not exists correspondence_campaign_recipients_status_idx
  on public.correspondence_campaign_recipients (campaign_id, status);
create table if not exists public.correspondence_campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.correspondence_campaigns(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists correspondence_campaign_events_idx
  on public.correspondence_campaign_events(campaign_id,created_at desc);
alter table public.correspondence_campaigns enable row level security;
alter table public.correspondence_campaign_recipients enable row level security;
alter table public.correspondence_campaign_events enable row level security;
revoke all on public.correspondence_campaigns, public.correspondence_campaign_recipients, public.correspondence_campaign_events from public,anon,authenticated;
grant select,insert,update on public.correspondence_campaigns,public.correspondence_campaign_recipients,public.correspondence_campaign_events to service_role;
grant usage,select on sequence public.correspondence_campaign_events_id_seq to service_role;
-- Deliberately no policies for anon/authenticated; browser users cannot bypass the server authorization checks.
