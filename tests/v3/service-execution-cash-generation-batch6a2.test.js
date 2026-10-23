const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261023063000_service_execution_layer_batch_6a2_cash_generation.sql'
    ),
    'utf8'
  );
}

describe('Service Execution Layer batch 6A-2 cash generation profile', () => {
  test('promotes exactly cash_generation_analysis', () => {
    const sql = migration();

    expect(sql).toContain("'cash_generation_analysis'");
    expect(sql).toContain("'cash_flow_analysis_run'");
    expect(sql).toContain("execution_status='automated'");
    expect(sql).toContain("execution_mode='capability_plan'");
    expect(sql).toContain("'service_execution_batch','6A-2'");
    expect(sql).toContain(
      "'cash_generation_method','period_net_cash_generation'"
    );
    expect(sql).toContain(
      "'requires_explicit_opening_balance',true"
    );
  });

  test('fails closed if baseline drifts', () => {
    const sql = migration();

    expect(sql).toContain('baseline_count <> 1');
    expect(sql).toContain('capability_count <> 1');
    expect(sql).toContain('batch 6A-2 baseline mismatch');
    expect(sql).toContain('batch 6A-2 capability mismatch');
  });

  test('does not activate neighboring services', () => {
    const sql = migration();

    expect(sql).not.toContain("'liquidity_gap_analysis'");
    expect(sql).not.toContain("'cash_conversion_cycle'");
    expect(sql).not.toContain("'free_cash_flow_analysis'");
    expect(sql).not.toContain("'cashflow_quality_analysis'");
  });
});
