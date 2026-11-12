-- Phase F.4 — Deal closing management. Additive only.

create table if not exists public.bonds_deal_closing_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  title text not null,
  category text not null default 'other'
    check (category in ('legal','financial','regulatory','corporate','commercial','other')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','satisfied','waived','blocked')),
  required boolean not null default true,
  due_at timestamptz,
  evidence_document_id uuid references public.bonds_deal_documents(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  satisfied_by uuid references auth.users(id) on delete set null,
  satisfied_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bonds_deal_closing_records (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  record_type text not null check (record_type in ('term_sheet','cap_table','funding_confirmation')),
  status text not null default 'pending'
    check (status in ('pending','signed','approved','confirmed','rejected')),
  check (
    (record_type = 'term_sheet' and status in ('pending','signed','rejected')) or
    (record_type = 'cap_table' and status in ('pending','approved','rejected')) or
    (record_type = 'funding_confirmation' and status in ('pending','confirmed','rejected'))
  ),
  offer_id uuid references public.bonds_deal_offers(id) on delete set null,
  document_id uuid references public.bonds_deal_documents(id) on delete set null,
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'SAR',
  reference text,
  effective_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bonds_deal_closing_items is 'Conditions-precedent and closing checklist for the canonical deal workspace.';
comment on table public.bonds_deal_closing_records is 'Governed evidence feeding lifecycle closing guards: signed term sheet, approved cap table, confirmed funds receipt.';

create index if not exists idx_bonds_deal_closing_items_status
  on public.bonds_deal_closing_items(deal_id,required,status,due_at);
create index if not exists idx_bonds_deal_closing_records_type
  on public.bonds_deal_closing_records(deal_id,record_type,effective_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_bonds_deal_closing_items_updated_at' and tgrelid='public.bonds_deal_closing_items'::regclass and not tgisinternal) then
    create trigger trg_bonds_deal_closing_items_updated_at before update on public.bonds_deal_closing_items
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_bonds_deal_closing_records_updated_at' and tgrelid='public.bonds_deal_closing_records'::regclass and not tgisinternal) then
    create trigger trg_bonds_deal_closing_records_updated_at before update on public.bonds_deal_closing_records
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;
end $$;

alter table public.bonds_deal_closing_items enable row level security;
alter table public.bonds_deal_closing_records enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_closing_items' and policyname='bonds_deal_closing_items_team_select') then
    create policy bonds_deal_closing_items_team_select on public.bonds_deal_closing_items
      for select to authenticated using (public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_closing_items' and policyname='bonds_deal_closing_items_owner_write') then
    create policy bonds_deal_closing_items_owner_write on public.bonds_deal_closing_items
      for all to authenticated using (public.bonds_deal_access_side(deal_id)='owner')
      with check (public.bonds_deal_access_side(deal_id)='owner');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_closing_records' and policyname='bonds_deal_closing_records_team_select') then
    create policy bonds_deal_closing_records_team_select on public.bonds_deal_closing_records
      for select to authenticated using (public.bonds_deal_access_side(deal_id) in ('owner','advisor','external_expert'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_deal_closing_records' and policyname='bonds_deal_closing_records_owner_write') then
    create policy bonds_deal_closing_records_owner_write on public.bonds_deal_closing_records
      for all to authenticated using (public.bonds_deal_access_side(deal_id)='owner')
      with check (public.bonds_deal_access_side(deal_id)='owner');
  end if;
end $$;

revoke all on public.bonds_deal_closing_items from anon;
revoke all on public.bonds_deal_closing_records from anon;
grant select on public.bonds_deal_closing_items to authenticated;
grant select on public.bonds_deal_closing_records to authenticated;
grant all on public.bonds_deal_closing_items to service_role;
grant all on public.bonds_deal_closing_records to service_role;
