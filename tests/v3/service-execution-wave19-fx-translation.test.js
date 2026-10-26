const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027004000_financial_core_wave19_fx_translation.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 19 FX translation service contract', () => {
  test('reuses the governed consolidation service instead of creating a parallel service', () => {
    const sql = migration();
    expect(sql).toContain("'consolidation_analysis'");
    expect(sql).toContain("'fx_translation_run'");
    expect(sql).not.toContain("'fx_translation_analysis'");
  });

  test('keeps translation deterministic and explicit-rate driven', () => {
    const sql = migration();
    expect(sql).toContain('"deterministic":true');
    expect(sql).toContain('"explicit_rates":true');
    expect(sql).toContain('"no_external_rate_provider":true');
  });

  test('does not create a parallel ledger or FX rate table', () => {
    const sql = migration();
    expect(sql.toLowerCase()).not.toContain('create table');
    expect(sql.toLowerCase()).not.toContain('create service');
  });
});
