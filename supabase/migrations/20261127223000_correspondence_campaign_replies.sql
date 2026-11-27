-- Inbound Zoho replies: verified only through a matching sent thread + exact address.
-- Metadata only. CRM activity IDs use the reply ID for replay-safe upserts.
create table if not exists public.correspondence_campaign_replies (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
 campaign_id uuid not null,
 recipient_id uuid not null,
 mailbox_id uuid not null,
 provider_message_id text not null check (provider_message_id ~ '^[0-9]{4,30}$'),
 provider_thread_id text not null check (provider_thread_id ~ '^[0-9]{4,30}$'),
 from_address text not null,
 subject text not null default '',
 preview text not null default '',
 received_at timestamptz,
 crm_activity_id uuid references public.crm_app_activities(id) on delete set null,
 crm_synced_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(recipient_id,campaign_id,workspace_id) references public.correspondence_campaign_recipients(id,campaign_id,workspace_id) on delete restrict,
 foreign key(mailbox_id,workspace_id) references public.correspondence_mailboxes(id,workspace_id) on delete restrict,
 unique(mailbox_id,provider_message_id)
);
create index if not exists correspondence_campaign_replies_campaign_idx
 on public.correspondence_campaign_replies(campaign_id,created_at desc);
alter table public.correspondence_campaign_replies enable row level security;
revoke all on public.correspondence_campaign_replies from public,anon,authenticated;
grant select,insert,update on public.correspondence_campaign_replies to service_role;
