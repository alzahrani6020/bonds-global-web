-- Cached social media posts fetched from connected platforms.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null references public.social_accounts(platform) on delete cascade,
  external_id text not null,
  content text,
  media_url text,
  permalink text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(platform, external_id)
);

comment on table public.social_posts is 'Cached posts from Instagram, YouTube and X';

create index if not exists idx_social_posts_platform_published
  on public.social_posts(platform, published_at desc);
