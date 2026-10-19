-- Funding file architecture anchored on funding_cases.
-- Adds dynamic stages/requirements and canonical per-case requirement state.

create table if not exists public.funding_file_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_ar text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funding_file_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  stage_id uuid not null references public.funding_file_stages(id) on delete restrict,
  label_ar text not null,
  label_en text not null,
  route_ar text not null,
  route_en text not null,
  source_table text not null,
  subject_type text,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  is_active boolean not null default true,
  completion_statuses text[] not null default array['submitted','reviewed','under_review','approved']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_file_requirements_source_table_check
    check (source_table in (
      'client_kyc_cases',
      'client_establishment_profiles',
      'client_business_activity_profiles',
      'client_cash_flow_reports',
      'client_receivables_aging_reports',
      'client_payables_aging_reports',
      'client_credit_consents'
    )),
  constraint funding_file_requirements_subject_type_check
    check (
      (source_table = 'client_credit_consents' and subject_type in ('business','individual'))
      or
      (source_table <> 'client_credit_consents' and subject_type is null)
    )
);

create table if not exists public.funding_case_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.funding_cases(id) on delete cascade,
  requirement_id uuid not null references public.funding_file_requirements(id) on delete restrict,
  source_record_id uuid,
  status text not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_case_submissions_case_requirement_key unique (case_id, requirement_id),
  constraint funding_case_submissions_status_check
    check (status in (
      'draft','submitted','reviewed','archived',
      'additional_information_required','under_review','approved',
      'rejected','closed','revoked'
    ))
);

create index if not exists idx_funding_file_stages_active_sort
  on public.funding_file_stages(is_active, sort_order);

create index if not exists idx_funding_file_requirements_stage_sort
  on public.funding_file_requirements(stage_id, is_active, sort_order);

create index if not exists idx_funding_case_submissions_case
  on public.funding_case_submissions(case_id, updated_at desc);

create index if not exists idx_funding_case_submissions_source
  on public.funding_case_submissions(source_record_id)
  where source_record_id is not null;

alter table public.funding_file_stages enable row level security;
alter table public.funding_file_requirements enable row level security;
alter table public.funding_case_submissions enable row level security;

drop policy if exists funding_file_stages_read_active on public.funding_file_stages;
create policy funding_file_stages_read_active
  on public.funding_file_stages
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists funding_file_requirements_read_active on public.funding_file_requirements;
create policy funding_file_requirements_read_active
  on public.funding_file_requirements
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists funding_case_submissions_select_own on public.funding_case_submissions;
create policy funding_case_submissions_select_own
  on public.funding_case_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.funding_cases c
      where c.id = funding_case_submissions.case_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists funding_case_submissions_insert_own on public.funding_case_submissions;
create policy funding_case_submissions_insert_own
  on public.funding_case_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.funding_cases c
      where c.id = funding_case_submissions.case_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists funding_case_submissions_update_own on public.funding_case_submissions;
create policy funding_case_submissions_update_own
  on public.funding_case_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.funding_cases c
      where c.id = funding_case_submissions.case_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.funding_cases c
      where c.id = funding_case_submissions.case_id
        and c.user_id = auth.uid()
    )
  );

grant select on public.funding_file_stages to anon, authenticated;
grant select on public.funding_file_requirements to anon, authenticated;
grant select, insert, update on public.funding_case_submissions to authenticated;

create or replace function public.touch_funding_file_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_funding_file_stages on public.funding_file_stages;
create trigger trg_touch_funding_file_stages
before update on public.funding_file_stages
for each row execute function public.touch_funding_file_updated_at();

drop trigger if exists trg_touch_funding_file_requirements on public.funding_file_requirements;
create trigger trg_touch_funding_file_requirements
before update on public.funding_file_requirements
for each row execute function public.touch_funding_file_updated_at();

drop trigger if exists trg_touch_funding_case_submissions on public.funding_case_submissions;
create trigger trg_touch_funding_case_submissions
before update on public.funding_case_submissions
for each row execute function public.touch_funding_file_updated_at();

insert into public.funding_file_stages (code,label_ar,label_en,sort_order,is_active) values
  ('client_business','بيانات العميل والمنشأة','Client & Business Information',10,true),
  ('financial','البيانات المالية','Financial Data',20,true),
  ('credit','الموافقات الائتمانية','Credit Consents',30,true)
on conflict (code) do update set
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.funding_file_requirements
(code,stage_id,label_ar,label_en,route_ar,route_en,source_table,subject_type,sort_order,is_required,is_active,completion_statuses)
select v.code,s.id,v.label_ar,v.label_en,v.route_ar,v.route_en,v.source_table,v.subject_type,v.sort_order,true,true,v.completion_statuses
from (
  values
    ('kyc','client_business','اعرف عميلك (KYC)','Know Your Customer (KYC)','/client/kyc','/en/client/kyc','client_kyc_cases',null,10,array['submitted','under_review','approved']::text[]),
    ('establishment','client_business','معلومات المنشأة','Establishment Information','/client/establishment-information','/en/client/establishment-information','client_establishment_profiles',null,20,array['submitted','reviewed']::text[]),
    ('activity','client_business','معلومات النشاط','Business Activity Information','/client/business-activity','/en/client/business-activity','client_business_activity_profiles',null,30,array['submitted','reviewed']::text[]),
    ('cash_flow','financial','التدفقات النقدية','Cash Flow','/client/cash-flow','/en/client/cash-flow','client_cash_flow_reports',null,10,array['submitted','reviewed']::text[]),
    ('receivables','financial','أعمار الذمم المدينة','Receivables Aging','/client/receivables-aging','/en/client/receivables-aging','client_receivables_aging_reports',null,20,array['submitted','reviewed']::text[]),
    ('payables','financial','أعمار الذمم الدائنة','Payables Aging','/client/payables-aging','/en/client/payables-aging','client_payables_aging_reports',null,30,array['submitted','reviewed']::text[]),
    ('credit_business','credit','موافقة ائتمانية — منشأة','Business Credit Consent','/client/credit-consent-business','/en/client/credit-consent-business','client_credit_consents','business',10,array['submitted']::text[]),
    ('credit_individual','credit','موافقة ائتمانية — فرد','Individual Credit Consent','/client/credit-consent-individual','/en/client/credit-consent-individual','client_credit_consents','individual',20,array['submitted']::text[])
) as v(code,stage_code,label_ar,label_en,route_ar,route_en,source_table,subject_type,sort_order,completion_statuses)
join public.funding_file_stages s on s.code = v.stage_code
on conflict (code) do update set
  stage_id = excluded.stage_id,
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  route_ar = excluded.route_ar,
  route_en = excluded.route_en,
  source_table = excluded.source_table,
  subject_type = excluded.subject_type,
  sort_order = excluded.sort_order,
  is_required = excluded.is_required,
  is_active = excluded.is_active,
  completion_statuses = excluded.completion_statuses,
  updated_at = now();

alter table public.client_kyc_cases add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_establishment_profiles add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_business_activity_profiles add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_cash_flow_reports add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_receivables_aging_reports add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_payables_aging_reports add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;
alter table public.client_credit_consents add column if not exists funding_case_id uuid references public.funding_cases(id) on delete set null;

create index if not exists idx_client_kyc_cases_funding_case on public.client_kyc_cases(funding_case_id, updated_at desc);
create index if not exists idx_client_establishment_profiles_funding_case on public.client_establishment_profiles(funding_case_id, updated_at desc);
create index if not exists idx_client_business_activity_profiles_funding_case on public.client_business_activity_profiles(funding_case_id, updated_at desc);
create index if not exists idx_client_cash_flow_reports_funding_case on public.client_cash_flow_reports(funding_case_id, updated_at desc);
create index if not exists idx_client_receivables_aging_reports_funding_case on public.client_receivables_aging_reports(funding_case_id, updated_at desc);
create index if not exists idx_client_payables_aging_reports_funding_case on public.client_payables_aging_reports(funding_case_id, updated_at desc);
create index if not exists idx_client_credit_consents_funding_case on public.client_credit_consents(funding_case_id, subject_type, updated_at desc);

create unique index if not exists uq_client_kyc_cases_case_draft
  on public.client_kyc_cases(funding_case_id)
  where funding_case_id is not null and status in ('draft','additional_information_required');

create unique index if not exists uq_client_establishment_profiles_case_draft
  on public.client_establishment_profiles(funding_case_id)
  where funding_case_id is not null and status = 'draft';

create unique index if not exists uq_client_business_activity_profiles_case_draft
  on public.client_business_activity_profiles(funding_case_id)
  where funding_case_id is not null and status = 'draft';

create unique index if not exists uq_client_cash_flow_reports_case_draft
  on public.client_cash_flow_reports(funding_case_id)
  where funding_case_id is not null and status = 'draft';

create unique index if not exists uq_client_receivables_aging_reports_case_draft
  on public.client_receivables_aging_reports(funding_case_id)
  where funding_case_id is not null and status = 'draft';

create unique index if not exists uq_client_payables_aging_reports_case_draft
  on public.client_payables_aging_reports(funding_case_id)
  where funding_case_id is not null and status = 'draft';

create unique index if not exists uq_client_credit_consents_case_subject_draft
  on public.client_credit_consents(funding_case_id,subject_type)
  where funding_case_id is not null and status = 'draft';

create or replace function public.sync_funding_case_submission()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_requirement_id uuid;
  v_expected_subject text := nullif(tg_argv[1], '');
begin
  if new.funding_case_id is null then
    return new;
  end if;

  if v_expected_subject is not null and new.subject_type is distinct from v_expected_subject then
    return new;
  end if;

  if not exists (
    select 1 from public.funding_cases c
    where c.id = new.funding_case_id
      and c.user_id = new.user_id
  ) then
    raise exception 'Funding case does not belong to form owner';
  end if;

  select id into v_requirement_id
  from public.funding_file_requirements
  where code = tg_argv[0] and is_active = true;

  if v_requirement_id is null then
    raise exception 'Unknown funding file requirement: %', tg_argv[0];
  end if;

  insert into public.funding_case_submissions(
    case_id,requirement_id,source_record_id,status,submitted_at
  ) values (
    new.funding_case_id,v_requirement_id,new.id,new.status,new.submitted_at
  )
  on conflict (case_id,requirement_id) do update set
    source_record_id = excluded.source_record_id,
    status = excluded.status,
    submitted_at = excluded.submitted_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_funding_kyc on public.client_kyc_cases;
create trigger trg_sync_funding_kyc after insert or update on public.client_kyc_cases
for each row execute function public.sync_funding_case_submission('kyc','');

drop trigger if exists trg_sync_funding_establishment on public.client_establishment_profiles;
create trigger trg_sync_funding_establishment after insert or update on public.client_establishment_profiles
for each row execute function public.sync_funding_case_submission('establishment','');

drop trigger if exists trg_sync_funding_activity on public.client_business_activity_profiles;
create trigger trg_sync_funding_activity after insert or update on public.client_business_activity_profiles
for each row execute function public.sync_funding_case_submission('activity','');

drop trigger if exists trg_sync_funding_cash_flow on public.client_cash_flow_reports;
create trigger trg_sync_funding_cash_flow after insert or update on public.client_cash_flow_reports
for each row execute function public.sync_funding_case_submission('cash_flow','');

drop trigger if exists trg_sync_funding_receivables on public.client_receivables_aging_reports;
create trigger trg_sync_funding_receivables after insert or update on public.client_receivables_aging_reports
for each row execute function public.sync_funding_case_submission('receivables','');

drop trigger if exists trg_sync_funding_payables on public.client_payables_aging_reports;
create trigger trg_sync_funding_payables after insert or update on public.client_payables_aging_reports
for each row execute function public.sync_funding_case_submission('payables','');

drop trigger if exists trg_sync_funding_credit_business on public.client_credit_consents;
create trigger trg_sync_funding_credit_business after insert or update on public.client_credit_consents
for each row execute function public.sync_funding_case_submission('credit_business','business');

drop trigger if exists trg_sync_funding_credit_individual on public.client_credit_consents;
create trigger trg_sync_funding_credit_individual after insert or update on public.client_credit_consents
for each row execute function public.sync_funding_case_submission('credit_individual','individual');

drop policy if exists client_kyc_cases_insert_own on public.client_kyc_cases;
create policy client_kyc_cases_insert_own on public.client_kyc_cases
for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    funding_case_id is null or exists (
      select 1 from public.funding_cases c
      where c.id = funding_case_id and c.user_id = auth.uid()
    )
  )
);

drop policy if exists client_kyc_cases_update_own on public.client_kyc_cases;
create policy client_kyc_cases_update_own on public.client_kyc_cases
for update to authenticated
using (user_id = auth.uid() and status in ('draft','additional_information_required'))
with check (
  user_id = auth.uid()
  and status in ('draft','additional_information_required','submitted')
  and (
    funding_case_id is null or exists (
      select 1 from public.funding_cases c
      where c.id = funding_case_id and c.user_id = auth.uid()
    )
  )
);

drop policy if exists establishment_profile_insert_own on public.client_establishment_profiles;
create policy establishment_profile_insert_own on public.client_establishment_profiles
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists establishment_profile_update_own on public.client_establishment_profiles;
create policy establishment_profile_update_own on public.client_establishment_profiles
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists business_activity_insert_own on public.client_business_activity_profiles;
create policy business_activity_insert_own on public.client_business_activity_profiles
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists business_activity_update_own on public.client_business_activity_profiles;
create policy business_activity_update_own on public.client_business_activity_profiles
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists cash_flow_insert_own on public.client_cash_flow_reports;
create policy cash_flow_insert_own on public.client_cash_flow_reports
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists cash_flow_update_own on public.client_cash_flow_reports;
create policy cash_flow_update_own on public.client_cash_flow_reports
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists receivables_aging_insert_own on public.client_receivables_aging_reports;
create policy receivables_aging_insert_own on public.client_receivables_aging_reports
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists receivables_aging_update_own on public.client_receivables_aging_reports;
create policy receivables_aging_update_own on public.client_receivables_aging_reports
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists payables_aging_insert_own on public.client_payables_aging_reports;
create policy payables_aging_insert_own on public.client_payables_aging_reports
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists payables_aging_update_own on public.client_payables_aging_reports;
create policy payables_aging_update_own on public.client_payables_aging_reports
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists credit_consents_insert_own on public.client_credit_consents;
create policy credit_consents_insert_own on public.client_credit_consents
for insert to authenticated
with check (
  user_id = auth.uid()
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);

drop policy if exists credit_consents_update_own on public.client_credit_consents;
create policy credit_consents_update_own on public.client_credit_consents
for update to authenticated
using (user_id = auth.uid() and status = 'draft')
with check (
  user_id = auth.uid()
  and status in ('draft','submitted')
  and (funding_case_id is null or exists (
    select 1 from public.funding_cases c where c.id = funding_case_id and c.user_id = auth.uid()
  ))
);
