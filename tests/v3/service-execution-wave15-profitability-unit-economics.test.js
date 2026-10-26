const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261026233000_financial_core_wave15_profitability_unit_economics.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 15 execution contract', () => {
  test('upgrades existing profitability service instead of creating a parallel profitability service', () => {
    const sql = migration();

    expect(sql).toContain("'profitability_analysis'");
    expect(sql).toContain("'profitability_intelligence_run'");
    expect(sql).toContain('"uses_existing_cost_allocation":true');
    expect(sql).not.toContain("'customer_profitability_analysis'");
    expect(sql).not.toContain("'product_profitability_analysis'");
  });

  test('publishes unit economics through the existing governed financial-engine path', () => {
    const sql = migration();

    expect(sql).toContain("'unit_economics_analysis'");
    expect(sql).toContain("'unit_economics_run'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain("'none'");
  });

  test('does not introduce AI or orchestrator execution', () => {
    const sql = migration();

    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
  });
});
