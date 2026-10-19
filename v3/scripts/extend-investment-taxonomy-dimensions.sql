
begin;

create table if not exists public.canonical_activity_business_forms (
  canonical_activity_id uuid not null references public.canonical_activities(id) on delete cascade,
  business_form_code text not null references public.investment_business_forms(code) on delete cascade,
  is_default boolean not null default false,
  country_code text references public.country_profiles(country_code) on delete cascade,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','partial','verified')),
  source text,
  source_url text,
  confidence integer check (confidence between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (canonical_activity_id,business_form_code,country_code)
);

create table if not exists public.project_model_investment_dimensions (
  project_model_id uuid primary key references public.project_models(id) on delete cascade,
  project_size_code text references public.investment_project_sizes(code),
  business_form_code text references public.investment_business_forms(code),
  primary_opportunity_type_code text references public.investment_opportunity_types(code),
  source text not null default 'legacy_project_model_mapping',
  confidence integer check (confidence between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_model_opportunity_types (
  project_model_id uuid not null references public.project_models(id) on delete cascade,
  opportunity_type_code text not null references public.investment_opportunity_types(code) on delete cascade,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (project_model_id,opportunity_type_code)
);

create unique index if not exists project_model_one_primary_opportunity
on public.project_model_opportunity_types(project_model_id)
where is_primary;

alter table public.canonical_activity_business_forms enable row level security;
alter table public.project_model_investment_dimensions enable row level security;
alter table public.project_model_opportunity_types enable row level security;

drop policy if exists "Public read canonical activity business forms" on public.canonical_activity_business_forms;
create policy "Public read canonical activity business forms"
on public.canonical_activity_business_forms for select to public using (true);

drop policy if exists "Public read project model investment dimensions" on public.project_model_investment_dimensions;
create policy "Public read project model investment dimensions"
on public.project_model_investment_dimensions for select to public using (true);

drop policy if exists "Public read project model opportunity types" on public.project_model_opportunity_types;
create policy "Public read project model opportunity types"
on public.project_model_opportunity_types for select to public using (true);

insert into public.project_model_investment_dimensions(
  project_model_id,project_size_code,primary_opportunity_type_code,source,confidence,metadata
)
select
  pm.id,
  case
    when pm.size_category in ('micro','small','medium','large') then pm.size_category
    else null
  end,
  case
    when pm.model_type in ('greenfield','brownfield') then pm.model_type
    else null
  end,
  'legacy_project_model_mapping',
  100,
  jsonb_build_object(
    'legacy_size_category',pm.size_category,
    'legacy_model_type',pm.model_type
  )
from public.project_models pm
on conflict (project_model_id) do update
set project_size_code=excluded.project_size_code,
    primary_opportunity_type_code=excluded.primary_opportunity_type_code,
    source=excluded.source,
    confidence=excluded.confidence,
    metadata=excluded.metadata,
    updated_at=now();

insert into public.project_model_opportunity_types(project_model_id,opportunity_type_code,is_primary)
select
  pm.id,
  pm.model_type,
  true
from public.project_models pm
where pm.model_type in ('greenfield','brownfield')
on conflict (project_model_id,opportunity_type_code) do update
set is_primary=excluded.is_primary;

commit;
