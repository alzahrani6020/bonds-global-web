const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261026234500_financial_core_wave16_management_reporting.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 16 management reporting execution contract', () => {
  test('publishes one management reporting service on existing governed execution path', () => {
    const sql = migration();

    expect(sql).toContain("'management_reporting'");
    expect(sql).toContain("'management_reporting_run'");
    expect(sql).toContain("'automated'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain('"no_parallel_reporting_store":true');
  });

  test('keeps commentary deterministic and AI-disabled', () => {
    const sql = migration();

    expect(sql).toContain('"no_ai_commentary":true');
    expect(sql).toContain("'none'");
    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
  });

  test('does not create CFO board monthly or KPI services separately', () => {
    const sql = migration();

    expect(sql).not.toContain("'cfo_reporting'");
    expect(sql).not.toContain("'board_reporting'");
    expect(sql).not.toContain("'monthly_management_reporting'");
    expect(sql).not.toContain("'kpi_reporting'");
  });
});
