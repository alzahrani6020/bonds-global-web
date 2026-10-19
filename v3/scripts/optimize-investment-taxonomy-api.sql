-- Performance indexes for the canonical investment taxonomy API.
create index if not exists idx_canonical_investment_subsectors_sector_sort
  on public.canonical_investment_subsectors(sector_id, sort_order);

create index if not exists idx_canonical_activity_investment_sectors_sector_primary
  on public.canonical_activity_investment_sectors(sector_id, is_primary)
  where is_primary = true;

create index if not exists idx_canonical_activity_investment_subsectors_subsector_primary
  on public.canonical_activity_investment_subsectors(subsector_id, is_primary)
  where is_primary = true;

create index if not exists idx_canonical_activity_business_forms_country_activity
  on public.canonical_activity_business_forms(country_code, canonical_activity_id);
