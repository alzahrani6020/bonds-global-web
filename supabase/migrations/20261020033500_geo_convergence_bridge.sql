-- Critical geo convergence bridge.
-- Keeps legacy city surfaces compatible while making geo_places the canonical identity.

begin;

alter table public.cities add column if not exists geo_place_id uuid;
alter table public.service_requests add column if not exists geo_place_id uuid;
alter table public.service_requests add column if not exists geo_snapshot jsonb not null default '{}'::jsonb;
alter table public.bonds_projects add column if not exists geo_place_id uuid;
alter table public.bonds_projects add column if not exists geo_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='cities_geo_place_id_fkey') then
    alter table public.cities
      add constraint cities_geo_place_id_fkey
      foreign key (geo_place_id) references public.geo_places(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='service_requests_geo_place_id_fkey') then
    alter table public.service_requests
      add constraint service_requests_geo_place_id_fkey
      foreign key (geo_place_id) references public.geo_places(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='bonds_projects_geo_place_id_fkey') then
    alter table public.bonds_projects
      add constraint bonds_projects_geo_place_id_fkey
      foreign key (geo_place_id) references public.geo_places(id) on delete set null;
  end if;
end $$;

create unique index if not exists uq_cities_geo_place_id
  on public.cities(geo_place_id) where geo_place_id is not null;
create index if not exists idx_service_requests_geo_place_id on public.service_requests(geo_place_id);
create index if not exists idx_bonds_projects_geo_place_id on public.bonds_projects(geo_place_id);

update public.cities c
set geo_place_id=gp.id
from public.geo_places gp
where c.geo_place_id is null
  and gp.source_code='bonds_legacy'
  and gp.source_id=c.id::text;

insert into public.geo_place_source_links(place_id,source_code,source_id,source_updated_at,confidence,metadata)
select
  gp.id,'bonds_legacy',c.id::text,c.updated_at,
  greatest(50,coalesce(gp.confidence,50)),
  jsonb_build_object('legacy_city_code',c.code,'bridge','cities.geo_place_id')
from public.cities c
join public.geo_places gp on gp.id=c.geo_place_id
on conflict(source_code,source_id) do update set
  place_id=excluded.place_id,
  source_updated_at=excluded.source_updated_at,
  confidence=greatest(public.geo_place_source_links.confidence,excluded.confidence),
  metadata=public.geo_place_source_links.metadata || excluded.metadata,
  updated_at=now();

create or replace function private.sync_city_to_geo_place()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_geo_id uuid;
  v_place_type text;
begin
  v_place_type := case
    when new.locality_type in ('city','town','village','hijra','hamlet','oasis','district','settlement')
      then new.locality_type
    else 'other'
  end;

  select gp.id into v_geo_id
  from public.geo_places gp
  where gp.source_code='bonds_legacy'
    and gp.source_id=new.id::text
  limit 1;

  if v_geo_id is null then
    select gp.id into v_geo_id
    from public.geo_places gp
    where gp.canonical_code=new.code
    limit 1;
  end if;

  if v_geo_id is null then
    insert into public.geo_places(
      canonical_code,country_code,name_ar,name_en,canonical_name,place_type,
      lat,lng,population,source_code,source_id,source_updated_at,confidence,
      is_canonical,is_active,metadata
    ) values (
      new.code,new.country_code,new.name_ar,new.name_en,
      coalesce(new.name_ar,new.name_en,new.code),v_place_type,
      new.lat::double precision,new.lng::double precision,new.population,
      'bonds_legacy',new.id::text,new.updated_at,70,true,
      coalesce(new.is_active,true),
      jsonb_build_object(
        'legacy_city_id',new.id,
        'legacy_region',new.region,
        'legacy_admin_level_2',new.admin_level_2,
        'managed_bridge','cities'
      )
    )
    returning id into v_geo_id;
  else
    update public.geo_places gp
    set country_code=new.country_code,
        name_ar=coalesce(new.name_ar,gp.name_ar),
        name_en=coalesce(new.name_en,gp.name_en),
        canonical_name=coalesce(new.name_ar,new.name_en,gp.canonical_name,new.code),
        place_type=v_place_type,
        lat=coalesce(new.lat::double precision,gp.lat),
        lng=coalesce(new.lng::double precision,gp.lng),
        population=coalesce(new.population::bigint,gp.population),
        is_active=coalesce(new.is_active,gp.is_active),
        metadata=gp.metadata || jsonb_build_object(
          'legacy_city_id',new.id,
          'legacy_region',new.region,
          'legacy_admin_level_2',new.admin_level_2,
          'managed_bridge','cities'
        ),
        updated_at=now()
    where gp.id=v_geo_id;
  end if;

  update public.cities
  set geo_place_id=v_geo_id
  where id=new.id
    and geo_place_id is distinct from v_geo_id;

  insert into public.geo_place_source_links(
    place_id,source_code,source_id,source_updated_at,confidence,metadata
  ) values (
    v_geo_id,'bonds_legacy',new.id::text,new.updated_at,70,
    jsonb_build_object('legacy_city_code',new.code,'bridge','cities.geo_place_id')
  )
  on conflict(source_code,source_id) do update set
    place_id=excluded.place_id,
    source_updated_at=excluded.source_updated_at,
    confidence=greatest(public.geo_place_source_links.confidence,excluded.confidence),
    metadata=public.geo_place_source_links.metadata || excluded.metadata,
    updated_at=now();

  return null;
end;
$$;

revoke all on function private.sync_city_to_geo_place() from public,anon,authenticated;
grant execute on function private.sync_city_to_geo_place() to service_role;

drop trigger if exists trg_cities_sync_geo_place on public.cities;
create trigger trg_cities_sync_geo_place
after insert or update of
  code,name_ar,name_en,country_code,population,lat,lng,locality_type,
  region,admin_level_2,is_active,geo_place_id
on public.cities
for each row execute function private.sync_city_to_geo_place();

update public.bonds_projects p
set geo_place_id=c.geo_place_id,
    geo_snapshot=jsonb_strip_nulls(jsonb_build_object(
      'geo_place_id',c.geo_place_id,
      'canonical_geo_code',gp.canonical_code,
      'country_code',gp.country_code,
      'name_ar',gp.name_ar,
      'name_en',gp.name_en,
      'place_type',gp.place_type,
      'lat',gp.lat,
      'lng',gp.lng,
      'confidence',gp.confidence,
      'resolved_from','legacy_city_id',
      'resolved_at',now()
    ))
from public.cities c
join public.geo_places gp on gp.id=c.geo_place_id
where p.city_id=c.id
  and p.geo_place_id is null;

commit;
