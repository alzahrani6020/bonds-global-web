const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261023041500_service_execution_layer_batch_5_financial_profiles.sql'
    ),
    'utf8'
  );
}

describe('Service Execution Layer batch 5 financial profiles', () => {
  const services = [
    'ebitda_analysis',
    'operating_margin_analysis',
    'inventory_turnover_analysis',
    'receivables_turnover_analysis',
    'cost_of_debt_analysis',
    'revenue_growth_analysis',
    'earnings_growth_analysis',
    'wacc_analysis'
  ];

  test('promotes exactly the eight batch 5 deterministic metric services', () => {
    const sql = migration();

    for (const service of services) {
      expect(sql).toContain(`'${service}'`);
    }

    expect(sql).toContain("primary_action='financial_analysis_run'");
    expect(sql).toContain("execution_status='automated'");
    expect(sql).toContain("'service_execution_batch', 5");
    expect(sql).toContain("'metric_scoped_execution', true");
  });

  test('fails closed when profile or capability baselines drift', () => {
    const sql = migration();

    expect(sql).toContain('baseline_count <> 8');
    expect(sql).toContain('capability_count <> 8');
    expect(sql).toContain('service execution batch 5 baseline mismatch');
    expect(sql).toContain('service execution batch 5 capability mismatch');
  });

  test('does not promote unresolved broader financial analyses', () => {
    const sql = migration();

    for (const excluded of [
      'dupont_analysis',
      'eva_analysis',
      'financial_leverage_analysis',
      'combined_leverage_analysis',
      'contribution_margin_analysis',
      'sustainable_growth_analysis'
    ]) {
      expect(sql).not.toContain(`'${excluded}'`);
    }
  });
});
