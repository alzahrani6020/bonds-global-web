-- BONDS HR: additive tenant-owned institutional company profile.
-- Does not modify company workspace ids, employees, memberships, entitlements or payroll.
create table if not exists public.hr_company_profiles (
 crm_workspace_id uuid primary key references public.crm_app_workspaces(id) on delete restrict,
 legal_name text,
 trade_name text,
 legal_form text,
 commercial_registration text,
 cr_issue_date date,
 cr_expiry_date date,
 unified_number text,
 vat_number text,
 social_insurance_number text,
 municipality_license_number text,
 municipality_license_expiry date,
 primary_activity text,
 secondary_activities text,
 city text,
 district text,
 street text,
 building_number text,
 postal_code text,
 additional_number text,
 national_address text,
 legal_representative text,
 contact_email text,
 contact_phone text,
 website text,
 logo_path text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 constraint hr_company_cr_dates check (cr_issue_date is null or cr_expiry_date is null or cr_expiry_date >= cr_issue_date),
 constraint hr_company_logo_path check (logo_path is null or logo_path like crm_workspace_id::text || '/%')
);
alter table public.hr_company_profiles enable row level security;
revoke all on public.hr_company_profiles from anon;
grant select, insert, update on public.hr_company_profiles to authenticated;
create policy hr_company_profiles_owner_read on public.hr_company_profiles
 for select to authenticated using (
 exists(select 1 from public.crm_app_workspaces w
 where w.id=crm_workspace_id and w.owner_user_id=(select auth.uid()))
);
create policy hr_company_profiles_owner_insert on public.hr_company_profiles
 for insert to authenticated with check (
 updated_by=(select auth.uid()) and exists(select 1 from public.crm_app_workspaces w
 where w.id=crm_workspace_id and w.owner_user_id=(select auth.uid()))
);
create policy hr_company_profiles_owner_update on public.hr_company_profiles
 for update to authenticated
 using (exists(select 1 from public.crm_app_workspaces w
 where w.id=crm_workspace_id and w.owner_user_id=(select auth.uid())))
 with check (updated_by=(select auth.uid()) and exists(
 select 1 from public.crm_app_workspaces w where w.id=crm_workspace_id and w.owner_user_id=(select auth.uid())
 ));
-- Private bucket: only the owning CRM workspace user can access its prefix.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hr-company-logos','hr-company-logos',false,2097152,array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do nothing;
create policy hr_company_logo_owner_read on storage.objects for select to authenticated
 using(bucket_id='hr-company-logos' and exists(
 select 1 from public.crm_app_workspaces w
 where w.id::text=(storage.foldername(name))[1] and w.owner_user_id=(select auth.uid())
 ));
create policy hr_company_logo_owner_insert on storage.objects for insert to authenticated
 with check(bucket_id='hr-company-logos' and exists(
 select 1 from public.crm_app_workspaces w
 where w.id::text=(storage.foldername(name))[1] and w.owner_user_id=(select auth.uid())
 ));
-- Immutable filenames avoid unsafe overwrites; no public access or delete policy.
