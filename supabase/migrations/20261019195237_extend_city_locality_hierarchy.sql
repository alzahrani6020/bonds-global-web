
begin;
alter table public.cities
  add column if not exists admin_level_2 text,
  add column if not exists locality_type text not null default 'city';

alter table public.cities drop constraint if exists cities_locality_type_check;
alter table public.cities add constraint cities_locality_type_check
  check (locality_type in ('city','town','village','hijra','district','other'));

create index if not exists idx_cities_country_region_locality
  on public.cities(country_code,region,locality_type,name_ar);
commit;
