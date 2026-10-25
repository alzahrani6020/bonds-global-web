const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261026230000_financial_core_wave14_treasury_liquidity.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 14 treasury execution contract', () => {
  test('publishes treasury on the existing governed financial-engine path', () => {
    const sql = migration();

    expect(sql).toContain("'treasury_liquidity_management'");
    expect(sql).toContain("'treasury_liquidity_run'");
    expect(sql).toContain("'automated'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain("'no_external_execution'");
    expect(sql).toContain("'no_hidden_limits'");
  });

  test('does not introduce AI, orchestrator, or external write execution', () => {
    const sql = migration();

    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
    expect(sql).toContain("'none'");
  });
});
