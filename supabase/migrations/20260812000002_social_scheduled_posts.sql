-- Scheduled social media posts

create table if not exists public.social_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  platforms text[] not null,
  content text not null,
  media_url text,
  media_type text default 'image',
  scheduled_at timestamptz not null,
  status text default 'pending' check (status in ('pending', 'published', 'failed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  published_at timestamptz,
  results jsonb default null
);

comment on table public.social_scheduled_posts is 'Posts scheduled for future publishing to social platforms';

create index if not exists idx_social_scheduled_posts_status_time
  on public.social_scheduled_posts(status, scheduled_at);
