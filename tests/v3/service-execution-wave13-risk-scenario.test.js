const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261026224500_financial_core_wave13_reverse_stress_early_warning.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 13 execution contract', () => {
  test('promotes existing early warning through the existing risk engine', () => {
    const sql = migration();

    expect(sql).toContain("'early_warning_analysis'");
    expect(sql).toContain("'risk_analysis_run'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain("'service_scope_required'");
  });

  test('publishes reverse stress through the existing scenario engine', () => {
    const sql = migration();

    expect(sql).toContain("'reverse_stress_testing'");
    expect(sql).toContain("'scenario_forecast_run'");
    expect(sql).toContain("'requires_explicit_sensitivity'");
    expect(sql).toContain("'no_hidden_thresholds'");
  });

  test('does not introduce a parallel orchestrator or AI execution path', () => {
    const sql = migration();

    expect(sql).not.toContain("'orchestrator_run'");
    expect(sql).not.toContain("'native_generate'");
    expect(sql).toContain("'none'");
  });
});
