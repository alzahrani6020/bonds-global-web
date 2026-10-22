begin;

-- Register deterministic financial engine capabilities against published services.
-- This migration does not replace existing primary_action/orchestrator profiles.
-- It only enriches service_capability_map so the assistant/orchestrator can select
-- a governed deterministic engine when the user intent requires computation.

with mappings(service_code, capability_code, run_order, is_required) as (
  values
    -- Core services
    ('financial_analysis','financial_analysis_run',10,true),
    ('cashflow_management','cash_flow_analysis_run',10,true),
    ('funding_readiness','funding_readiness_run',10,true),
    ('funding_readiness','creditworthiness_run',20,false),
    ('feasibility_studies','feasibility_run',10,true),
    ('asset_company_valuation','valuation_run',10,true),
    ('risk_analysis','risk_analysis_run',10,true),

    -- Advanced analysis -> financial analysis engine
    ('financial_leverage_analysis','financial_analysis_run',10,true),
    ('operating_leverage_analysis','financial_analysis_run',10,true),
    ('combined_leverage_analysis','financial_analysis_run',10,true),
    ('capital_structure_analysis','financial_analysis_run',10,true),
    ('debt_analysis','financial_analysis_run',10,true),
    ('debt_to_equity_analysis','financial_analysis_run',10,true),
    ('interest_coverage_analysis','financial_analysis_run',10,true),
    ('cost_of_debt_analysis','financial_analysis_run',10,true),
    ('wacc_analysis','financial_analysis_run',10,true),
    ('roe_analysis','financial_analysis_run',10,true),
    ('roa_analysis','financial_analysis_run',10,true),
    ('roic_analysis','financial_analysis_run',10,true),
    ('roce_analysis','financial_analysis_run',10,true),
    ('ebitda_analysis','financial_analysis_run',10,true),
    ('gross_margin_analysis','financial_analysis_run',10,true),
    ('operating_margin_analysis','financial_analysis_run',10,true),
    ('net_margin_analysis','financial_analysis_run',10,true),
    ('contribution_margin_analysis','financial_analysis_run',10,true),
    ('working_capital_analysis','financial_analysis_run',10,true),
    ('horizontal_analysis','financial_analysis_run',10,true),
    ('vertical_analysis','financial_analysis_run',10,true),
    ('trend_analysis','financial_analysis_run',10,true),
    ('period_comparison_analysis','financial_analysis_run',10,true),
    ('budget_comparison_analysis','financial_analysis_run',10,true),
    ('benchmarking_analysis','financial_analysis_run',10,true),
    ('solvency_analysis','financial_analysis_run',10,true),
    ('operating_efficiency_analysis','financial_analysis_run',10,true),
    ('asset_turnover_analysis','financial_analysis_run',10,true),
    ('inventory_turnover_analysis','financial_analysis_run',10,true),
    ('receivables_turnover_analysis','financial_analysis_run',10,true),
    ('payables_turnover_analysis','financial_analysis_run',10,true),
    ('receivables_aging_analysis','financial_analysis_run',10,true),
    ('payables_aging_analysis','financial_analysis_run',10,true),
    ('going_concern_analysis','financial_analysis_run',10,true),
    ('earnings_quality_analysis','financial_analysis_run',10,true),
    ('revenue_growth_analysis','financial_analysis_run',10,true),
    ('earnings_growth_analysis','financial_analysis_run',10,true),
    ('dupont_analysis','financial_analysis_run',10,true),
    ('eva_analysis','financial_analysis_run',10,true),
    ('sustainable_growth_analysis','financial_analysis_run',10,true),
    ('net_debt_analysis','financial_analysis_run',10,true),
    ('net_debt_ebitda','financial_analysis_run',10,true),
    ('financial_diagnostics','financial_analysis_run',10,true),

    -- Cash-flow family
    ('cash_flow_statement','cash_flow_analysis_run',10,true),
    ('free_cash_flow_analysis','cash_flow_analysis_run',10,true),
    ('cash_generation_analysis','cash_flow_analysis_run',10,true),
    ('cashflow_quality_analysis','cash_flow_analysis_run',10,true),
    ('liquidity_gap_analysis','cash_flow_analysis_run',10,true),
    ('cash_conversion_cycle','cash_flow_analysis_run',20,false),

    -- Funding / credit family
    ('dscr_analysis','funding_readiness_run',10,true),
    ('borrowing_capacity_analysis','funding_readiness_run',10,true),
    ('funding_gap_analysis','funding_readiness_run',10,true),
    ('future_funding_needs','funding_readiness_run',10,true),
    ('refinancing_risk_analysis','funding_readiness_run',20,false),

    -- Scenario / stress family
    ('sensitivity_analysis','scenario_forecast_run',10,true),
    ('scenario_analysis','scenario_forecast_run',10,true),
    ('stress_testing','scenario_forecast_run',10,true),

    -- Risk family
    ('early_warning_analysis','risk_analysis_run',10,true),
    ('distress_risk_analysis','risk_analysis_run',10,true),
    ('interest_rate_risk_analysis','risk_analysis_run',10,true),
    ('currency_risk_analysis','risk_analysis_run',10,true),
    ('customer_concentration_analysis','risk_analysis_run',10,true),
    ('supplier_concentration_analysis','risk_analysis_run',10,true),
    ('off_balance_sheet_analysis','risk_analysis_run',10,true),
    ('contingent_liabilities_analysis','risk_analysis_run',10,true)
)
insert into public.service_capability_map(service_id, capability_code, run_order, is_required)
select s.id, m.capability_code, m.run_order, m.is_required
from mappings m
join public.service_catalog s on s.code = m.service_code
where s.status='published' and s.is_active=true
on conflict(service_id, capability_code) do update
set run_order=excluded.run_order,
    is_required=excluded.is_required;

-- Keep current execution profiles intact. Only mark the existence of deterministic
-- financial execution support in metadata for discovery/assistant use.
update public.service_execution_profiles p
set metadata = coalesce(p.metadata,'{}'::jsonb) ||
  jsonb_build_object('deterministic_financial_engine', true),
    updated_at = now()
where exists (
  select 1
  from public.service_capability_map scm
  where scm.service_id = p.service_id
    and scm.capability_code in (
      'financial_analysis_run',
      'cash_flow_analysis_run',
      'funding_readiness_run',
      'creditworthiness_run',
      'feasibility_run',
      'valuation_run',
      'risk_analysis_run',
      'scenario_forecast_run'
    )
);

commit;
