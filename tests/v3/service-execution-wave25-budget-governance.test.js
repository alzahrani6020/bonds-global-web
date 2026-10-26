'use strict';

const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027009000_financial_core_wave25_budget_governance.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 25 budget governance execution contract', () => {
  test('extends the existing planning service without replacing FIN-043', () => {
    const sql = migration();
    expect(sql).toContain("'planning_budgeting_forecasting'");
    expect(sql).toContain("'accounting_budget_plan_create'");
    expect(sql).toContain("'accounting_budget_draft_save'");
    expect(sql).toContain("'accounting_budget_version_transition'");
    expect(sql).toContain("'accounting_budget_analysis'");
    expect(sql).toContain("p.primary_action='planning_budgeting_run'");
    expect(sql).not.toContain("primary_action = 'accounting_budget_analysis'");
  });

  test('keeps approved baselines immutable and actuals canonical', () => {
    const sql = migration();
    expect(sql).toContain("where status = 'approved'");
    expect(sql).toContain("ACCOUNTING_BUDGET_VERSION_IMMUTABLE");
    expect(sql).toContain("public.accounting_journal_entries");
    expect(sql).toContain("public.accounting_journal_lines");
    expect(sql).toContain('"canonical_ledger_actuals":true');
    expect(sql).toContain('"no_parallel_ledger":true');
  });

  test('keeps AI out of governed budget values', () => {
    const sql = migration();
    expect(sql).toContain('"no_ai_budget_values":true');
    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
  });
});
