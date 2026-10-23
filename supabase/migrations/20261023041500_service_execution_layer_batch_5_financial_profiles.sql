begin;

-- Batch 5 promotes only exact deterministic metrics supported by financial_analysis_run.

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
    'ebitda_analysis',
    'operating_margin_analysis',
    'inventory_turnover_analysis',
    'receivables_turnover_analysis',
    'cost_of_debt_analysis',
    'revenue_growth_analysis',
    'earnings_growth_analysis',
    'wacc_analysis'
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
      'service execution batch 5 baseline mismatch: expected 8 profiles, found %',
      baseline_count;
  end if;

  select count(*)
    into capability_count
  from public.service_catalog s
  join public.service_capability_map m on m.service_id=s.id
  where s.code in (
    'ebitda_analysis',
    'operating_margin_analysis',
    'inventory_turnover_analysis',
    'receivables_turnover_analysis',
    'cost_of_debt_analysis',
    'revenue_growth_analysis',
    'earnings_growth_analysis',
    'wacc_analysis'
  )
    and m.capability_code='financial_analysis_run'
    and m.is_required=true;

  if capability_count <> 8 then
    raise exception
      'service execution batch 5 capability mismatch: expected 8 mappings, found %',
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
        'service_execution_batch', 5,
        'metric_scoped_execution', true
      ),
    updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and s.code in (
    'ebitda_analysis',
    'operating_margin_analysis',
    'inventory_turnover_analysis',
    'receivables_turnover_analysis',
    'cost_of_debt_analysis',
    'revenue_growth_analysis',
    'earnings_growth_analysis',
    'wacc_analysis'
  )
  and s.status='published'
  and s.is_active=true
  and p.is_active=true;

commit;
