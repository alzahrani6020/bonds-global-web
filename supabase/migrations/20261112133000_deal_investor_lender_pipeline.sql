-- Bonds Deal Operating System - F.3 investor/lender pipeline and offer comparison.
-- Additive only. No destructive DDL/DML.

create table if not exists public.bonds_deal_pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  party_id uuid not null references public.bonds_deal_parties(id) on delete cascade,
  member_id uuid references public.bonds_deal_members(id) on delete set null,
  kind text not null check (kind in ('investor','lender','buyer')),
  status text not null default 'identified'
    check (status in ('identified','contacted','nda_pending','nda_signed','materials_sent','meeting','ioi_received','term_sheet_received','shortlisted','declined','selected')),
  source text,
  relationship_owner text,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_id, party_id)
);

comment on table public.bonds_deal_pipeline_entries is 'Deal-level investor/lender/buyer outreach pipeline reusing bonds_deal_parties as the canonical counterparty identity.';
comment on column public.bonds_deal_pipeline_entries.status is 'Commercial outreach state; does not imply regulatory placement or execution.';
comment on column public.bonds_deal_pipeline_entries.next_action_at is 'Next planned outreach/action timestamp.';

create table if not exists public.bonds_deal_offers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  pipeline_entry_id uuid not null references public.bonds_deal_pipeline_entries(id) on delete cascade,
  offer_type text not null check (offer_type in ('ioi','term_sheet','revised_term_sheet')),
  status text not null default 'received'
    check (status in ('received','under_review','shortlisted','rejected','accepted','withdrawn')),
  currency text not null default 'SAR',
  amount numeric,
  valuation numeric,
  equity_percent numeric,
  interest_rate_percent numeric,
  tenor_months integer,
  fee_amount numeric,
  conditions text,
  received_at timestamptz not null default now(),
  expires_at timestamptz,
  document_id uuid references public.bonds_deal_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount >= 0),
  check (valuation is null or valuation >= 0),
  check (equity_percent is null or (equity_percent >= 0 and equity_percent <= 100)),
  check (interest_rate_percent is null or (interest_rate_percent >= 0 and interest_rate_percent <= 100)),
  check (tenor_months is null or tenor_months >= 0),
  check (fee_amount is null or fee_amount >= 0)
);

comment on table public.bonds_deal_offers is 'Indications of interest and term-sheet records for side-by-side decision comparison inside a deal.';
comment on column public.bonds_deal_offers.offer_type is 'ioi, term_sheet, or revised_term_sheet; signing evidence belongs to F.4 closing.';
comment on column public.bonds_deal_offers.document_id is 'Optional evidence document stored in the governed deal data room.';

create index if not exists idx_bonds_deal_pipeline_status
  on public.bonds_deal_pipeline_entries(deal_id,status,next_action_at);
create index if not exists idx_bonds_deal_offers_deal
  on public.bonds_deal_offers(deal_id,status,received_at desc);
create index if not exists idx_bonds_deal_offers_pipeline
  on public.bonds_deal_offers(pipeline_entry_id,received_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname='trg_bonds_deal_pipeline_updated_at'
      and tgrelid='public.bonds_deal_pipeline_entries'::regclass and not tgisinternal
  ) then
    create trigger trg_bonds_deal_pipeline_updated_at
    before update on public.bonds_deal_pipeline_entries
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname='trg_bonds_deal_offers_updated_at'
      and tgrelid='public.bonds_deal_offers'::regclass and not tgisinternal
  ) then
    create trigger trg_bonds_deal_offers_updated_at
    before update on public.bonds_deal_offers
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;
end;
$$;

alter table public.bonds_deal_pipeline_entries enable row level security;
alter table public.bonds_deal_offers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_pipeline_entries' and policyname='bonds_deal_pipeline_team_select') then
    create policy bonds_deal_pipeline_team_select on public.bonds_deal_pipeline_entries
      for select to authenticated
      using (public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_pipeline_entries' and policyname='bonds_deal_pipeline_owner_write') then
    create policy bonds_deal_pipeline_owner_write on public.bonds_deal_pipeline_entries
      for all to authenticated
      using (public.bonds_deal_access_side(deal_id)='owner')
      with check (public.bonds_deal_access_side(deal_id)='owner');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_offers' and policyname='bonds_deal_offers_team_select') then
    create policy bonds_deal_offers_team_select on public.bonds_deal_offers
      for select to authenticated
      using (public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_offers' and policyname='bonds_deal_offers_owner_write') then
    create policy bonds_deal_offers_owner_write on public.bonds_deal_offers
      for all to authenticated
      using (public.bonds_deal_access_side(deal_id)='owner')
      with check (public.bonds_deal_access_side(deal_id)='owner');
  end if;
end;
$$;

revoke all on public.bonds_deal_pipeline_entries from anon;
revoke all on public.bonds_deal_offers from anon;
grant select on public.bonds_deal_pipeline_entries to authenticated;
grant select on public.bonds_deal_offers to authenticated;
grant all on public.bonds_deal_pipeline_entries to service_role;
grant all on public.bonds_deal_offers to service_role;
