-- Critical geo convergence bridge.
-- Keeps legacy city surfaces compatible while making geo_places the canonical identity.

begin;

alter table public.cities add column if not exists geo_place_id uuid;
alter table public.service_requests add column if not exists geo_place_id uuid;
alter table public.service_requests add column if not exists geo_snapshot jsonb not null default '{}'::jsonb;
alter table public.bonds_projects add column if not exists geo_place_id uuid;
alter table public.bonds_projects add column if not exists geo_snapshot jsonb not null default '{}'::jsonb;

do $do$
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
end $do$;

drop index if exists public.uq_cities_geo_place_id;
create index if not exists idx_cities_geo_place_id
  on public.cities(geo_place_id);
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
as $func$
declare
  v_geo_id uuid;
  v_place_type text;
  v_is_alias boolean := false;
begin
  v_place_type := case
    when new.locality_type in ('city','town','village','hijra','hamlet','oasis','district','settlement')
      then new.locality_type
    else 'other'
  end;

  select gp.id into v_geo_id
  from public.geo_place_source_links l
  join public.geo_places gp on gp.id=l.place_id
  where l.source_code='bonds_legacy'
    and l.source_id=new.id::text
  limit 1;

  if v_geo_id is null then
    select gp.id into v_geo_id
    from public.geo_places gp
    where gp.source_code='bonds_legacy'
      and gp.source_id=new.id::text
    limit 1;
  end if;

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
    select gp.canonical_code is distinct from new.code
    into v_is_alias
    from public.geo_places gp
    where gp.id=v_geo_id;

    if not coalesce(v_is_alias,false) then
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
    else
      update public.geo_places gp
      set metadata=gp.metadata || jsonb_build_object(
            'last_legacy_alias_id',new.id,
            'last_legacy_alias_code',new.code,
            'managed_bridge','cities'
          ),
          updated_at=now()
      where gp.id=v_geo_id;
    end if;
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
$func$;

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


create or replace function private.enforce_service_request_geo()
returns trigger
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_place public.geo_places%rowtype;
begin
  if new.geo_place_id is null and new.locality_code is not null then
    select gp.* into v_place
    from public.geo_places gp
    where gp.canonical_code=new.locality_code and gp.is_active=true
    limit 1;

    if v_place.id is null then
      select gp.* into v_place
      from public.cities c
      join public.geo_places gp on gp.id=c.geo_place_id
      where c.code=new.locality_code and gp.is_active=true
      limit 1;
    end if;

    if v_place.id is not null then
      new.geo_place_id := v_place.id;
    end if;
  end if;

  if new.geo_place_id is null then
    new.geo_snapshot := '{}'::jsonb;
    return new;
  end if;

  if v_place.id is null then
    select gp.* into v_place
    from public.geo_places gp
    where gp.id=new.geo_place_id and gp.is_active=true;
  end if;

  if v_place.id is null then
    raise exception 'Invalid or inactive geo_place_id';
  end if;

  if new.country_code is not null and upper(new.country_code) <> v_place.country_code then
    raise exception 'geo_place_id country mismatch';
  end if;

  new.country_code := coalesce(new.country_code,v_place.country_code);
  new.geo_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'geo_place_id',v_place.id,
    'canonical_geo_code',v_place.canonical_code,
    'country_code',v_place.country_code,
    'name_ar',v_place.name_ar,
    'name_en',v_place.name_en,
    'place_type',v_place.place_type,
    'lat',v_place.lat,
    'lng',v_place.lng,
    'confidence',v_place.confidence,
    'source_code',v_place.source_code,
    'captured_at',now()
  ));

  return new;
end;
$func$;

revoke all on function private.enforce_service_request_geo() from public,anon,authenticated;
grant execute on function private.enforce_service_request_geo() to service_role;

drop trigger if exists trg_service_requests_enforce_geo on public.service_requests;
create trigger trg_service_requests_enforce_geo
before insert or update of geo_place_id,locality_code,country_code
on public.service_requests
for each row execute function private.enforce_service_request_geo();

create or replace function private.enforce_project_geo()
returns trigger
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_city_geo uuid;
  v_place public.geo_places%rowtype;
begin
  if new.city_id is not null then
    select c.geo_place_id into v_city_geo
    from public.cities c
    where c.id=new.city_id;

    if v_city_geo is not null and new.geo_place_id is null then
      new.geo_place_id := v_city_geo;
    elsif v_city_geo is not null and new.geo_place_id is not null and v_city_geo <> new.geo_place_id then
      raise exception 'city_id and geo_place_id mismatch';
    end if;
  end if;

  if new.geo_place_id is null then
    new.geo_snapshot := '{}'::jsonb;
    return new;
  end if;

  select gp.* into v_place
  from public.geo_places gp
  where gp.id=new.geo_place_id and gp.is_active=true;

  if v_place.id is null then
    raise exception 'Invalid or inactive geo_place_id';
  end if;

  new.geo_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'geo_place_id',v_place.id,
    'canonical_geo_code',v_place.canonical_code,
    'country_code',v_place.country_code,
    'name_ar',v_place.name_ar,
    'name_en',v_place.name_en,
    'place_type',v_place.place_type,
    'lat',v_place.lat,
    'lng',v_place.lng,
    'confidence',v_place.confidence,
    'source_code',v_place.source_code,
    'captured_at',now()
  ));

  return new;
end;
$func$;

revoke all on function private.enforce_project_geo() from public,anon,authenticated;
grant execute on function private.enforce_project_geo() to service_role;

drop trigger if exists trg_bonds_projects_enforce_geo on public.bonds_projects;
create trigger trg_bonds_projects_enforce_geo
before insert or update of city_id,geo_place_id
on public.bonds_projects
for each row execute function private.enforce_project_geo();


create or replace function public.dq_find_geo_integrity()
returns bigint
language plpgsql
security definer
set search_path to 'public','auth'
as $func$
declare
  v_count bigint := 0;
begin
  insert into public.data_quality_issues(
    check_type,entity_type,entity_id,field_name,severity,message,metadata
  )
  select 'geo_integrity','city',c.id,'geo_place_id','critical',
         'المدينة غير مرتبطة بالسجل الجغرافي المرجعي',
         jsonb_build_object('city_code',c.code,'country_code',c.country_code)
  from public.cities c
  where coalesce(c.is_active,true)=true and c.geo_place_id is null

  union all

  select 'geo_integrity','city',c.id,'geo_place_id','high',
         'رمز المدينة لا يطابق الرمز الجغرافي المرجعي المرتبط',
         jsonb_build_object('city_code',c.code,'canonical_geo_code',gp.canonical_code)
  from public.cities c
  join public.geo_places gp on gp.id=c.geo_place_id
  where c.code is distinct from gp.canonical_code

  union all

  select 'geo_integrity','geo_place',gp.id,'location','critical',
         'السجل الجغرافي يحتوي إحداثياً جزئياً فقط',
         jsonb_build_object('canonical_geo_code',gp.canonical_code,'lat',gp.lat,'lng',gp.lng)
  from public.geo_places gp
  where gp.is_active=true
    and ((gp.lat is null and gp.lng is not null) or (gp.lat is not null and gp.lng is null))

  union all

  select 'geo_integrity','geo_place',gp.id,'source_link','high',
         'السجل الجغرافي القديم لا يحتوي رابط provenance مطابقاً',
         jsonb_build_object('canonical_geo_code',gp.canonical_code,'source_id',gp.source_id)
  from public.geo_places gp
  where gp.is_active=true
    and gp.source_code='bonds_legacy'
    and not exists (
      select 1
      from public.geo_place_source_links l
      where l.place_id=gp.id
        and l.source_code='bonds_legacy'
        and l.source_id=gp.source_id
    )

  union all

  select 'geo_integrity','service_request',sr.id,'geo_place_id','medium',
         'طلب الخدمة يحتوي موقعاً محلياً غير مربوط بهوية جغرافية canonical',
         jsonb_build_object(
           'request_reference',sr.request_reference,
           'country_code',sr.country_code,
           'locality_code',sr.locality_code
         )
  from public.service_requests sr
  where (sr.locality_code is not null or sr.locality_name is not null)
    and sr.geo_place_id is null
    and sr.status not in ('cancelled')

  union all

  select 'geo_integrity','bonds_project',p.id,'geo_place_id','high',
         'المشروع مرتبط بمدينة قديمة دون هوية جغرافية canonical',
         jsonb_build_object('project_number',p.project_number,'city_id',p.city_id)
  from public.bonds_projects p
  where p.city_id is not null and p.geo_place_id is null

  union all

  select 'geo_integrity','geo_ingest_run',r.id,'status','high',
         'تشغيل الاستيعاب الجغرافي متوقف أو فاشل ويحتاج مراجعة',
         jsonb_build_object('status',r.status,'stage',r.stage,'metrics',r.metrics)
  from geo_ingest.runs r
  where r.status in ('failed','blocked');

  get diagnostics v_count = row_count;
  return v_count;
end;
$func$;

revoke all on function public.dq_find_geo_integrity() from public,anon,authenticated;
grant execute on function public.dq_find_geo_integrity() to service_role;

create or replace function public.dq_run_all_checks()
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $func$
declare
  v_dup bigint;
  v_miss bigint;
  v_broken bigint;
  v_incomp bigint;
  v_geo bigint;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     and not public.is_advisory_manager() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  perform public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  v_geo := public.dq_find_geo_integrity();

  return jsonb_build_object(
    'duplicates',v_dup,
    'missing_fields',v_miss,
    'broken_relations',v_broken,
    'incomplete_projects',v_incomp,
    'geo_integrity',v_geo
  );
end;
$func$;

commit;
