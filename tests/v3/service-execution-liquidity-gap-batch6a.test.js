const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261023054500_service_execution_layer_batch_6a_liquidity_gap.sql'
    ),
    'utf8'
  );
}

describe('Service Execution Layer batch 6A liquidity gap profile', () => {
  test('promotes exactly liquidity_gap_analysis to cash flow execution', () => {
    const sql = migration();

    expect(sql).toContain("'liquidity_gap_analysis'");
    expect(sql).toContain("'cash_flow_analysis_run'");
    expect(sql).toContain("execution_status='automated'");
    expect(sql).toContain("execution_mode='capability_plan'");
    expect(sql).toContain("'service_execution_batch','6A'");
    expect(sql).toContain("'liquidity_gap_method','peak_cumulative_cash_deficit'");
    expect(sql).toContain("'requires_explicit_opening_balance',true");
  });

  test('fails closed if profile or capability baseline drifts', () => {
    const sql = migration();

    expect(sql).toContain('baseline_count <> 1');
    expect(sql).toContain('capability_count <> 1');
    expect(sql).toContain('batch 6A baseline mismatch');
    expect(sql).toContain('batch 6A capability mismatch');
  });

  test('does not promote the other pending cash flow services', () => {
    const sql = migration();

    expect(sql).not.toContain("'cash_conversion_cycle'");
    expect(sql).not.toContain("'cash_generation_analysis'");
  });
});
