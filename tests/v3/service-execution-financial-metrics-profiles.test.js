const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261023034500_service_execution_layer_batch_4_financial_profiles.sql'
    ),
    'utf8'
  );
}

describe('Service Execution Layer batch 4 metric-scoped profiles', () => {
  const services = [
    'working_capital_analysis',
    'asset_turnover_analysis',
    'net_debt_analysis',
    'net_debt_ebitda',
    'gross_margin_analysis',
    'net_margin_analysis',
    'debt_to_equity_analysis',
    'interest_coverage_analysis'
  ];

  test('promotes exactly the eight metric-scoped financial services', () => {
    const sql = migration();

    for (const service of services) {
      expect(sql).toContain(`'${service}'`);
    }

    expect(sql).toContain("primary_action='financial_analysis_run'");
    expect(sql).toContain("execution_status='automated'");
    expect(sql).toContain("execution_mode='capability_plan'");
    expect(sql).toContain("'metric_scoped_execution', true");
  });

  test('fails closed when profile or capability baselines drift', () => {
    const sql = migration();

    expect(sql).toContain('baseline_count <> 8');
    expect(sql).toContain('capability_count <> 8');
    expect(sql).toContain('service execution batch 4 baseline mismatch');
    expect(sql).toContain('service execution batch 4 capability mismatch');
  });

  test('does not promote services without exact deterministic metric semantics', () => {
    const sql = migration();

    for (const excluded of [
      'operating_margin_analysis',
      'wacc_analysis',
      'currency_risk_analysis',
      'interest_rate_risk_analysis',
      'stress_testing',
      'sensitivity_analysis'
    ]) {
      expect(sql).not.toContain(`'${excluded}'`);
    }
  });
});
