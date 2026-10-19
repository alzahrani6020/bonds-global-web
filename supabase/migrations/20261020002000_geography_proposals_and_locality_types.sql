-- Bonds Global — geography proposals and richer locality types
-- User-submitted geography stays outside canonical cities until reviewed.

begin;

alter table public.cities drop constraint if exists cities_locality_type_check;
alter table public.cities add constraint cities_locality_type_check
  check (locality_type in ('city','town','village','hijra','hamlet','oasis','district','settlement','other'));

create table if not exists public.geography_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text references public.country_profiles(country_code) on delete set null,
  proposal_type text not null check (proposal_type in ('region','locality')),
  locality_type text check (
    locality_type is null or locality_type in
      ('city','town','village','hijra','hamlet','oasis','district','settlement','other')
  ),
  parent_region text,
  proposed_name_ar text not null check (char_length(btrim(proposed_name_ar)) between 2 and 160),
  proposed_name_en text check (proposed_name_en is null or char_length(btrim(proposed_name_en)) <= 160),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','mapped','rejected')),
  canonical_target_code text,
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_geography_proposals_user_created
  on public.geography_proposals(user_id, created_at desc);

create index if not exists idx_geography_proposals_review
  on public.geography_proposals(status, proposal_type, country_code, created_at desc);

alter table public.geography_proposals enable row level security;

drop policy if exists "Users insert own geography proposals" on public.geography_proposals;
create policy "Users insert own geography proposals"
  on public.geography_proposals
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users read own geography proposals" on public.geography_proposals;
create policy "Users read own geography proposals"
  on public.geography_proposals
  for select to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.geography_proposals to authenticated;

comment on table public.geography_proposals is
  'User-submitted region/locality suggestions pending review; never treated as canonical geography until mapped or approved.';

commit;
