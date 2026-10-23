const fs = require('fs');
const path = require('path');

function readMigration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261023031000_service_execution_layer_batch_3_profiles.sql'
    ),
    'utf8'
  );
}

describe('Service Execution Layer batch 3 profile activation', () => {
  test('promotes only exact-match deterministic financial services', () => {
    const sql = readMigration();

    const expected = [
      ['financial_analysis', 'financial_analysis_run'],
      ['cashflow_management', 'cash_flow_analysis_run'],
      ['dscr_analysis', 'funding_readiness_run'],
      ['scenario_analysis', 'scenario_forecast_run']
    ];

    for (const [service, action] of expected) {
      expect(sql).toContain(`('${service}','${action}')`);
    }

    const tuples = [...sql.matchAll(/\('([a-z0-9_]+)','([a-z0-9_]+_run)'\)/g)]
      .map(match => [match[1], match[2]]);

    expect(tuples).toEqual(expected);
  });

  test('fails closed when profile or capability baselines drift', () => {
    const sql = readMigration();

    expect(sql).toContain('baseline_count <> 4');
    expect(sql).toContain('capability_count <> 4');
    expect(sql).toContain('service execution batch 3 baseline mismatch');
    expect(sql).toContain('service execution batch 3 capability mismatch');
  });

  test('marks direct engine execution as automated capability plans', () => {
    const sql = readMigration();

    expect(sql).toContain("execution_status='automated'");
    expect(sql).toContain("execution_mode='capability_plan'");
    expect(sql).toContain('primary_action=d.primary_action');
    expect(sql).toContain("'direct_financial_engine_primary', true");
  });

  test('does not promote broad mappings whose named outputs are unsupported', () => {
    const sql = readMigration();

    for (const unsupported of [
      'wacc_analysis',
      'currency_risk_analysis',
      'interest_rate_risk_analysis',
      'stress_testing',
      'sensitivity_analysis'
    ]) {
      expect(sql).not.toContain(`('${unsupported}',`);
    }
  });
});
