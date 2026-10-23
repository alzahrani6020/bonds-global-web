begin;

-- Batch 4 promotes only services whose named metric is produced directly by
-- financial_analysis_run. Broader mapped services remain non-primary until
-- their dedicated deterministic formulas exist.

do $$
declare
  baseline_count integer;
  capability_count integer;
begin
  select count(*)
    into baseline_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id=s.id
  where s.code in (
    'working_capital_analysis',
    'asset_turnover_analysis',
    'net_debt_analysis',
    'net_debt_ebitda',
    'gross_margin_analysis',
    'net_margin_analysis',
    'debt_to_equity_analysis',
    'interest_coverage_analysis'
  )
    and s.status='published'
    and s.is_active=true
    and p.is_active=true
    and p.execution_status='request_only'
    and p.execution_mode='request_only'
    and p.primary_action is null
    and p.version=1;

  if baseline_count <> 8 then
    raise exception
      'service execution batch 4 baseline mismatch: expected 8 profiles, found %',
      baseline_count;
  end if;

  select count(*)
    into capability_count
  from public.service_catalog s
  join public.service_capability_map m on m.service_id=s.id
  where s.code in (
    'working_capital_analysis',
    'asset_turnover_analysis',
    'net_debt_analysis',
    'net_debt_ebitda',
    'gross_margin_analysis',
    'net_margin_analysis',
    'debt_to_equity_analysis',
    'interest_coverage_analysis'
  )
    and m.capability_code='financial_analysis_run'
    and m.is_required=true;

  if capability_count <> 8 then
    raise exception
      'service execution batch 4 capability mismatch: expected 8 mappings, found %',
      capability_count;
  end if;
end
$$;

update public.service_execution_profiles p
set execution_status='automated',
    execution_mode='capability_plan',
    primary_action='financial_analysis_run',
    version=p.version+1,
    metadata=coalesce(p.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'direct_financial_engine_primary', true,
        'service_execution_batch', 4,
        'metric_scoped_execution', true
      ),
    updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and s.code in (
    'working_capital_analysis',
    'asset_turnover_analysis',
    'net_debt_analysis',
    'net_debt_ebitda',
    'gross_margin_analysis',
    'net_margin_analysis',
    'debt_to_equity_analysis',
    'interest_coverage_analysis'
  )
  and s.status='published'
  and s.is_active=true
  and p.is_active=true;

commit;
