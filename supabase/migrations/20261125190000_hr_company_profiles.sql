-- Additive institutional metadata keyed to existing CRM workspace; no rewrites.
create table if not exists public.hr_company_profiles (
 crm_workspace_id uuid primary key references public.crm_app_workspaces(id) on delete restrict,
 legal_name text, trading_name text, legal_entity_type text,
 commercial_registration text, commercial_registration_issued_at date,
 commercial_registration_expires_at date, unified_number text,
 national_establishment_number text, vat_number text, vat_registration_status text,
 gosi_number text, municipal_license_number text, municipal_license_expires_at date,
 business_activity text, secondary_activities text, city text, district text,
 street text, building_number text, postal_code text, additional_number text,
 phone text, email text, website text, representative_name text,
 hr_contact_name text, logo_path text, updated_at timestamptz not null default now(),
 constraint hr_company_profile_logo_scope check (
   logo_path is null or logo_path ~ ('^' || crm_workspace_id::text || '/logo[.](png|jpg|webp)$')
 ),
 constraint hr_company_profile_vat_length check (vat_number is null or length(vat_number)<=30)
);
alter table public.hr_company_profiles enable row level security;
revoke all on public.hr_company_profiles from anon;
grant select,insert,update on public.hr_company_profiles to authenticated;
drop policy if exists hr_company_profiles_owner_read on public.hr_company_profiles;
create policy hr_company_profiles_owner_read on public.hr_company_profiles
 for select to authenticated using (
 exists (select 1 from public.crm_app_workspaces c
 where c.id=crm_workspace_id and c.owner_user_id=(select auth.uid()))
);
drop policy if exists hr_company_profiles_owner_insert on public.hr_company_profiles;
create policy hr_company_profiles_owner_insert on public.hr_company_profiles
 for insert to authenticated with check (
 exists (select 1 from public.crm_app_workspaces c
 where c.id=crm_workspace_id and c.owner_user_id=(select auth.uid()))
);
drop policy if exists hr_company_profiles_owner_update on public.hr_company_profiles;
create policy hr_company_profiles_owner_update on public.hr_company_profiles
 for update to authenticated using (
 exists (select 1 from public.crm_app_workspaces c
 where c.id=crm_workspace_id and c.owner_user_id=(select auth.uid()))
) with check (
 exists (select 1 from public.crm_app_workspaces c
 where c.id=crm_workspace_id and c.owner_user_id=(select auth.uid()))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hr-company-branding','hr-company-branding',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
drop policy if exists hr_branding_owner_select on storage.objects;
create policy hr_branding_owner_select on storage.objects
 for select to authenticated using (
 bucket_id='hr-company-branding'
 and name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
 and exists (select 1 from public.crm_app_workspaces c
 where c.id::text=(storage.foldername(name))[1] and c.owner_user_id=(select auth.uid()))
);
drop policy if exists hr_branding_owner_insert on storage.objects;
create policy hr_branding_owner_insert on storage.objects
 for insert to authenticated with check (
 bucket_id='hr-company-branding'
 and name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
 and exists (select 1 from public.crm_app_workspaces c
 where c.id::text=(storage.foldername(name))[1] and c.owner_user_id=(select auth.uid()))
);
drop policy if exists hr_branding_owner_update on storage.objects;
create policy hr_branding_owner_update on storage.objects
 for update to authenticated using (
 bucket_id='hr-company-branding'
 and name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
 and exists (select 1 from public.crm_app_workspaces c
 where c.id::text=(storage.foldername(name))[1] and c.owner_user_id=(select auth.uid()))
) with check (
 bucket_id='hr-company-branding'
 and name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
 and exists (select 1 from public.crm_app_workspaces c
 where c.id::text=(storage.foldername(name))[1] and c.owner_user_id=(select auth.uid()))
);
