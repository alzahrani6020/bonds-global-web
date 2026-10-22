begin;

do $$
declare
  expected_count integer;
begin
  select count(*)
    into expected_count
  from public.service_execution_profiles p
  join public.service_catalog s on s.id = p.service_id
  where s.status = 'published'
    and s.is_active = true
    and p.is_active = true
    and p.execution_status = 'partially_automated'
    and p.execution_mode = 'request_only'
    and p.primary_action is null
    and (
      (s.code = 'break_even_analysis' and p.tool_id = 'break-even')
      or
      (s.code in (
        'cash_flow_statement',
        'cashflow_management',
        'cashflow_quality_analysis',
        'free_cash_flow_analysis'
      ) and p.tool_id = 'cash-flow')
      or
      (s.code in (
        'roa_analysis',
        'roce_analysis',
        'roe_analysis',
        'roic_analysis'
      ) and p.tool_id = 'roi')
    );

  if expected_count <> 9 then
    raise exception
      'service execution batch 2 baseline mismatch: expected 9 eligible profiles, found %',
      expected_count;
  end if;
end
$$;

update public.service_execution_profiles p
set execution_mode = 'capability_plan',
    primary_action = 'calculator_open',
    version = p.version + 1,
    updated_at = now()
from public.service_catalog s
where p.service_id = s.id
  and s.status = 'published'
  and s.is_active = true
  and p.is_active = true
  and p.execution_status = 'partially_automated'
  and p.execution_mode = 'request_only'
  and p.primary_action is null
  and (
    (s.code = 'break_even_analysis' and p.tool_id = 'break-even')
    or
    (s.code in (
      'cash_flow_statement',
      'cashflow_management',
      'cashflow_quality_analysis',
      'free_cash_flow_analysis'
    ) and p.tool_id = 'cash-flow')
    or
    (s.code in (
      'roa_analysis',
      'roce_analysis',
      'roe_analysis',
      'roic_analysis'
    ) and p.tool_id = 'roi')
  );

insert into public.service_capability_map (
  service_id,
  capability_code,
  run_order,
  is_required
)
select
  s.id,
  'calculator_open',
  5,
  true
from public.service_catalog s
where s.status = 'published'
  and s.is_active = true
  and s.code in (
    'break_even_analysis',
    'cash_flow_statement',
    'cashflow_management',
    'cashflow_quality_analysis',
    'free_cash_flow_analysis',
    'roa_analysis',
    'roce_analysis',
    'roe_analysis',
    'roic_analysis'
  )
on conflict (service_id, capability_code) do update
set run_order = excluded.run_order,
    is_required = excluded.is_required;

commit;
