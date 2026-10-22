begin;

create table if not exists public.service_groups (
  code text primary key,
  category_code text not null references public.service_categories(code) on delete cascade,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_catalog
  add column if not exists group_code text references public.service_groups(code) on delete set null;

create index if not exists idx_service_catalog_group_code
  on public.service_catalog(group_code);

alter table public.service_groups enable row level security;

drop policy if exists "Public read active service groups" on public.service_groups;
create policy "Public read active service groups"
on public.service_groups
for select
to anon, authenticated
using (is_active = true);

grant select on public.service_groups to anon, authenticated;

insert into public.service_groups
(code, category_code, name_ar, name_en, description_ar, description_en, sort_order, is_active, metadata)
values
('accounting_records','financial_advisory','المحاسبة والسجلات','Accounting & Ledgers','القيود والأستاذ وميزان المراجعة والتسويات والإقفال.','Journal entries, ledgers, trial balance, adjustments and closing.',10,true,'{"surface":"service_discovery"}'),
('financial_statements_reporting','financial_advisory','القوائم والتقارير المالية','Financial Statements & Reporting','إعداد القوائم المالية والإيضاحات المرتبطة بها.','Financial statements and related disclosures.',20,true,'{"surface":"service_discovery"}'),
('audit_opinion','financial_advisory','المراجعة والتدقيق والرأي','Review, Audit & Opinion','المراجعة والتدقيق والرأي المالي والمحاسبي.','Review, audit, financial and accounting opinion.',30,true,'{"surface":"service_discovery"}'),
('planning_cashflow','financial_advisory','التخطيط والموازنات والتدفقات','Planning, Budgets & Cash Flow','الموازنات والتخطيط وإدارة التدفقات والاستراتيجية المالية.','Budgeting, planning, cash flow management and financial strategy.',40,true,'{"surface":"service_discovery"}'),
('core_financial_analysis','financial_advisory','التحليل المالي الأساسي','Core Financial Analysis','التحليل المالي والنسب والربحية والسيولة والانحرافات.','Financial analysis, ratios, profitability, liquidity and variances.',50,true,'{"surface":"service_discovery"}'),
('leverage_capital_debt','financial_advisory','الرافعة وهيكل رأس المال والمديونية','Leverage, Capital Structure & Debt','الرافعة والمديونية وهيكل رأس المال وتغطية الدين وتكلفة التمويل.','Leverage, debt, capital structure, coverage and financing cost.',60,true,'{"surface":"service_discovery"}'),
('returns_margins','financial_advisory','العائد والهوامش والتعادل','Returns, Margins & Break-even','العوائد والهوامش ونقطة التعادل وهامش الأمان.','Returns, margins, break-even and margin of safety.',70,true,'{"surface":"service_discovery"}'),
('working_capital_cash','financial_advisory','رأس المال العامل والتحويل النقدي','Working Capital & Cash Conversion','رأس المال العامل والتحصيل والسداد وجودة التدفقات النقدية.','Working capital, collections, payments and cash-flow quality.',80,true,'{"surface":"service_discovery"}'),
('comparative_trends','financial_advisory','المقارنات والاتجاهات','Comparisons & Trends','التحليل الأفقي والرأسي والاتجاهات والمقارنات.','Horizontal, vertical, trend and comparative analysis.',90,true,'{"surface":"service_discovery"}'),
('risk_resilience','financial_advisory','المخاطر والملاءة والتعثر','Risk, Solvency & Distress','الملاءة والاستمرارية والإنذار المبكر والتعثر واختبارات الضغط.','Solvency, going concern, early warning, distress and stress testing.',100,true,'{"surface":"service_discovery"}'),
('growth_value_diagnostics','financial_advisory','القيمة والنمو والتشخيص','Value, Growth & Diagnostics','القيمة الاقتصادية والنمو المستدام والفجوات التمويلية والتشخيص الشامل.','Economic value, sustainable growth, funding gaps and diagnostics.',110,true,'{"surface":"service_discovery"}'),
('studies_valuation','studies_valuation','الدراسات والتقييم','Studies & Valuation','دراسات الجدوى وتقييم الأصول والشركات وتحليل المخاطر.','Feasibility studies, valuation and risk analysis.',10,true,'{"surface":"service_discovery"}'),
('funding_restructuring','funding_restructuring','التمويل وإعادة الهيكلة','Funding & Restructuring','الجاهزية التمويلية واستخراج التمويل وإحياء المشاريع.','Funding readiness, funding extraction and project restructuring.',10,true,'{"surface":"service_discovery"}'),
('business_market','business_market','الأعمال والسوق','Business & Market','الاستشارات التشغيلية والبحوث والدراسات السوقية.','Operational consulting and market research.',10,true,'{"surface":"service_discovery"}')
on conflict(code) do update set
  category_code=excluded.category_code,
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  description_ar=excluded.description_ar,
  description_en=excluded.description_en,
  sort_order=excluded.sort_order,
  is_active=true,
  metadata=public.service_groups.metadata || excluded.metadata,
  updated_at=now();

update public.service_catalog set group_code='accounting_records'
where code in ('daily_journal_entries','general_ledger','trial_balance','accounting_adjustments','financial_closing');

update public.service_catalog set group_code='financial_statements_reporting'
where code in ('financial_statements','income_statement','statement_financial_position','cash_flow_statement','changes_in_equity','financial_statement_notes');

update public.service_catalog set group_code='audit_opinion'
where code in ('financial_review_audit','financial_accounting_opinion');

update public.service_catalog set group_code='planning_cashflow'
where code in ('cashflow_management','budgeting_forecasting','financial_strategy','cost_centers');

update public.service_catalog set group_code='core_financial_analysis'
where code in ('financial_analysis','expense_revenue_analysis','variance_analysis','financial_ratios','profitability_analysis','liquidity_analysis');

update public.service_catalog set group_code='leverage_capital_debt'
where code in (
'financial_leverage_analysis','operating_leverage_analysis','combined_leverage_analysis',
'capital_structure_analysis','debt_analysis','debt_to_equity_analysis','interest_coverage_analysis',
'dscr_analysis','borrowing_capacity_analysis','cost_of_debt_analysis','wacc_analysis',
'net_debt_analysis','net_debt_ebitda'
);

update public.service_catalog set group_code='returns_margins'
where code in (
'roe_analysis','roa_analysis','roic_analysis','roce_analysis','ebitda_analysis',
'gross_margin_analysis','operating_margin_analysis','net_margin_analysis',
'contribution_margin_analysis','break_even_analysis','margin_of_safety_analysis'
);

update public.service_catalog set group_code='working_capital_cash'
where code in (
'accounts_receivable','accounts_payable','bank_reconciliation',
'working_capital_analysis','cash_conversion_cycle','free_cash_flow_analysis',
'cash_generation_analysis','cashflow_quality_analysis','receivables_turnover_analysis',
'payables_turnover_analysis','receivables_aging_analysis','payables_aging_analysis'
);

update public.service_catalog set group_code='comparative_trends'
where code in (
'revenue_growth_analysis','earnings_growth_analysis','horizontal_analysis','vertical_analysis',
'trend_analysis','period_comparison_analysis','budget_comparison_analysis','benchmarking_analysis',
'operating_efficiency_analysis','asset_turnover_analysis','inventory_turnover_analysis'
);

update public.service_catalog set group_code='risk_resilience'
where code in (
'sensitivity_analysis','scenario_analysis','stress_testing','earnings_quality_analysis',
'solvency_analysis','going_concern_analysis','liquidity_gap_analysis','refinancing_risk_analysis',
'interest_rate_risk_analysis','currency_risk_analysis','customer_concentration_analysis',
'supplier_concentration_analysis','off_balance_sheet_analysis','contingent_liabilities_analysis',
'early_warning_analysis','distress_risk_analysis','altman_z_score','dupont_analysis'
);

update public.service_catalog set group_code='growth_value_diagnostics'
where code in (
'eva_analysis','sustainable_growth_analysis','funding_gap_analysis',
'future_funding_needs','financial_diagnostics'
);

update public.service_catalog set group_code='studies_valuation'
where category_code='studies_valuation';

update public.service_catalog set group_code='funding_restructuring'
where category_code='funding_restructuring';

update public.service_catalog set group_code='business_market'
where category_code='business_market';

commit;
