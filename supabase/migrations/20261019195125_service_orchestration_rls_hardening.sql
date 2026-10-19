
begin;

drop policy if exists "Public read service activity map" on public.service_activity_map;
create policy "Public read published service activity map"
on public.service_activity_map for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service country map" on public.service_country_map;
create policy "Public read published service country map"
on public.service_country_map for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service sector map" on public.service_sector_map;
create policy "Public read published service sector map"
on public.service_sector_map for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service goal map" on public.service_goal_map;
create policy "Public read published service goal map"
on public.service_goal_map for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service capability map" on public.service_capability_map;
revoke select on public.service_capability_map from anon,authenticated;

drop policy if exists "Public read service forms" on public.service_form_definitions;
create policy "Public read published service forms"
on public.service_form_definitions for select to anon,authenticated
using (
  status='published' and is_active=true and
  exists (
    select 1 from public.service_catalog s
    where s.id=service_id and s.status='published' and s.is_active=true
  )
);

drop policy if exists "Public read service form fields" on public.service_form_fields;
create policy "Public read published service form fields"
on public.service_form_fields for select to anon,authenticated
using (exists (
  select 1
  from public.service_form_definitions f
  join public.service_catalog s on s.id=f.service_id
  where f.id=form_id and f.status='published' and f.is_active=true
    and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service requirements" on public.service_requirements;
create policy "Public read published service requirements"
on public.service_requirements for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service deliverables" on public.service_deliverables;
create policy "Public read published service deliverables"
on public.service_deliverables for select to anon,authenticated
using (exists (
  select 1 from public.service_catalog s
  where s.id=service_id and s.status='published' and s.is_active=true
));

drop policy if exists "Public read service dependencies" on public.service_dependencies;
create policy "Public read published service dependencies"
on public.service_dependencies for select to anon,authenticated
using (
  exists (
    select 1 from public.service_catalog s
    where s.id=service_id and s.status='published' and s.is_active=true
  )
  and exists (
    select 1 from public.service_catalog d
    where d.id=depends_on_service_id and d.status='published' and d.is_active=true
  )
);

drop policy if exists "Public read package items" on public.service_package_items;
create policy "Public read published package items"
on public.service_package_items for select to anon,authenticated
using (
  exists (
    select 1 from public.service_packages p
    where p.id=package_id and p.status='published' and p.is_active=true
  )
  and exists (
    select 1 from public.service_catalog s
    where s.id=service_id and s.status='published' and s.is_active=true
  )
);

drop policy if exists "Public read public service procedures" on public.service_procedures;
create policy "Public read published service procedures"
on public.service_procedures for select to anon,authenticated
using (
  visibility='public' and
  exists (
    select 1 from public.service_catalog s
    where s.id=service_id and s.status='published' and s.is_active=true
  )
);

commit;
