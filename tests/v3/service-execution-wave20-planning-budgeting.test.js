const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027005000_financial_core_wave20_planning_budgeting.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 20 planning budgeting execution contract', () => {
  test('publishes one governed planning service on the existing financial engine path', () => {
    const sql = migration();
    expect(sql).toContain("'planning_budgeting_forecasting'");
    expect(sql).toContain("'planning_budgeting_run'");
    expect(sql).toContain("'automated'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain('"single_planning_service":true');
  });

  test('keeps planning deterministic and AI disabled', () => {
    const sql = migration();
    expect(sql).toContain('"no_ai_budget_values":true');
    expect(sql).toContain('"no_inferred_growth":true');
    expect(sql).toContain('"no_inferred_seasonality":true');
    expect(sql).toContain("'none'");
    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
  });

  test('does not create a parallel planning data store', () => {
    const sql = migration().toLowerCase();
    expect(sql).not.toContain('create table');
    expect(sql).toContain('"no_parallel_planning_store":true');
  });
});
