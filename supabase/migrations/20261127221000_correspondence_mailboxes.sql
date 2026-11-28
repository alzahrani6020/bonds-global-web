-- BONDS company-specific Zoho OAuth mailboxes and short-lived connection attempts.
-- Server-only access; NO client or anonymous grants, no plaintext credentials.
create table if not exists public.correspondence_mailboxes (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
 provider text not null default 'zoho' check(provider='zoho'),
 address text not null,
 account_id text not null check(account_id ~ '^[0-9]{4,24}$'),
 region text not null default 'com' check(region in ('com','eu','in','comau','jp','ca','comcn','ae','sa')),
 encrypted_refresh_token text not null,
 enabled boolean not null default false,
 verified_at timestamptz,
 connected_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (id,workspace_id)
);
create unique index if not exists correspondence_mailboxes_company_address_uidx
 on public.correspondence_mailboxes(workspace_id,lower(trim(address)));
create unique index if not exists correspondence_mailboxes_sender_global_uidx
 on public.correspondence_mailboxes(lower(trim(address)));
create table if not exists public.correspondence_mailbox_oauth_states (
 id uuid primary key default gen_random_uuid(),
 state_hash char(64) not null unique,
 workspace_id uuid not null references public.crm_app_workspaces(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 requested_address text not null,
 region text not null check(region in ('com','eu','in','comau','jp','ca','comcn','ae','sa')),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists correspondence_mailbox_states_expiry_idx on public.correspondence_mailbox_oauth_states(expires_at);
alter table public.correspondence_mailboxes enable row level security;
alter table public.correspondence_mailbox_oauth_states enable row level security;
revoke all on public.correspondence_mailboxes,public.correspondence_mailbox_oauth_states from public,anon,authenticated;
grant select,insert,update on public.correspondence_mailboxes,public.correspondence_mailbox_oauth_states to service_role;
