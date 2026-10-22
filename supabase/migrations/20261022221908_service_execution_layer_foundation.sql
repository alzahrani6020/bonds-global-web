begin;

create table if not exists public.service_execution_profiles (
  service_id uuid primary key references public.service_catalog(id) on delete cascade,
  execution_status text not null default 'request_only'
    check (execution_status in ('catalog_only','request_only','partially_automated','automated','ai_assisted','fully_orchestrated')),
  execution_mode text not null default 'request_only'
    check (execution_mode in ('request_only','capability_plan')),
  primary_action text,
  orchestrator_intent text,
  tool_id text,
  ai_mode text not null default 'none'
    check (ai_mode in ('none','explain_only','assist','generate')),
  research_mode text not null default 'none'
    check (research_mode in ('none','optional','automatic')),
  token_mode text not null default 'as_required'
    check (token_mode in ('none','as_required','required')),
  assistant_enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_execution_profiles enable row level security;
revoke all on public.service_execution_profiles from anon, authenticated;
grant select, insert, update, delete on public.service_execution_profiles to service_role;

insert into public.service_execution_profiles(service_id)
select id from public.service_catalog
where status='published' and is_active=true
on conflict(service_id) do nothing;

update public.service_execution_profiles p
set execution_status='fully_orchestrated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='feasibility',
    tool_id='feasibility-template', ai_mode='assist', research_mode='automatic',
    token_mode='as_required', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='feasibility_studies';

update public.service_execution_profiles p
set execution_status='fully_orchestrated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='value_asset',
    ai_mode='assist', research_mode='optional', token_mode='as_required', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='asset_company_valuation';

update public.service_execution_profiles p
set execution_status='fully_orchestrated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='risk_analysis',
    ai_mode='assist', research_mode='automatic', token_mode='as_required', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='risk_analysis';

update public.service_execution_profiles p
set execution_status='fully_orchestrated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='market_analysis',
    ai_mode='assist', research_mode='automatic', token_mode='as_required', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='market_research';

update public.service_execution_profiles p
set execution_status='fully_orchestrated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='request_financing',
    tool_id=case when s.code='funding_readiness' then 'creditworthiness' else null end,
    ai_mode='assist', research_mode='optional', token_mode='as_required', updated_at=now()
from public.service_catalog s
where p.service_id=s.id and s.code in ('funding_extraction','funding_readiness');

update public.service_execution_profiles p
set execution_status='partially_automated', execution_mode='capability_plan',
    primary_action='orchestrator_run', orchestrator_intent='risk_analysis',
    ai_mode='assist', research_mode='optional', token_mode='as_required', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='project_rescue';

update public.service_execution_profiles p
set execution_status='partially_automated', tool_id='break-even',
    ai_mode='explain_only', updated_at=now()
from public.service_catalog s where p.service_id=s.id and s.code='break_even_analysis';

update public.service_execution_profiles p
set execution_status='partially_automated', tool_id='cash-flow',
    ai_mode='explain_only', updated_at=now()
from public.service_catalog s
where p.service_id=s.id and s.code in ('cashflow_management','cash_flow_statement','free_cash_flow_analysis','cashflow_quality_analysis');

update public.service_execution_profiles p
set execution_status='partially_automated', tool_id='roi',
    ai_mode='explain_only', updated_at=now()
from public.service_catalog s
where p.service_id=s.id and s.code in ('roe_analysis','roa_analysis','roic_analysis','roce_analysis');

insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id,'orchestrator_run',5,true
from public.service_catalog s
where s.code in (
  'feasibility_studies','asset_company_valuation','risk_analysis',
  'market_research','funding_extraction','funding_readiness','project_rescue'
)
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

commit;
