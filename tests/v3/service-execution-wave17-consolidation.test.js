const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027002000_financial_core_wave17_consolidation_service.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 17 consolidation service contract', () => {
  test('publishes one governed consolidation service with ledger-backed report as primary action', () => {
    const sql = migration();

    expect(sql).toContain("'consolidation_analysis'");
    expect(sql).toContain("'accounting_consolidation_report'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain('"no_parallel_ledger":true');
  });

  test('maps group setup, intercompany linking, calculation and reporting under one service', () => {
    const sql = migration();

    expect(sql).toContain("'accounting_group_configure'");
    expect(sql).toContain("'accounting_intercompany_link'");
    expect(sql).toContain("'consolidation_run'");
    expect(sql).toContain("'accounting_consolidation_report'");
  });

  test('keeps execution deterministic and AI-disabled', () => {
    const sql = migration();

    expect(sql).toContain("'none'");
    expect(sql).not.toContain("'native_generate'");
    expect(sql).not.toContain("'orchestrator_run'");
  });

  test('does not create a second ledger or separate intercompany service', () => {
    const sql = migration();

    expect(sql).not.toContain("'intercompany_analysis'");
    expect(sql).not.toContain("'consolidation_ledger'");
  });
});
