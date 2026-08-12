-- Social accounts configuration (non-secret metadata only)
-- Actual tokens live in Vercel environment variables.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  account_id text,
  account_name text,
  is_active boolean default true,
  config_json jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

comment on table public.social_accounts is 'Non-secret configuration for connected social media accounts';

-- Initial seed rows for the three supported platforms.
insert into public.social_accounts (platform, account_name, is_active, config_json)
values
  ('instagram', 'Bonds Instagram', true, '{}'),
  ('youtube', 'Bonds YouTube', true, '{}'),
  ('x', 'Bonds X', true, '{}')
on conflict (platform) do nothing;
