'use strict';

const fs = require('fs');
const path = require('path');
const generated = require('../../lib/capabilities/generated-service-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');

describe('governed ledger report service capabilities', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(process.cwd(),'services/manifests/financial-engine.service.json'),
    'utf8'
  ).replace(/^\uFEFF/,''));
  const router = fs.readFileSync(
    path.join(process.cwd(),'lib/services/service-execution-router.js'),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261026033800_activate_ledger_report_services.sql'),
    'utf8'
  );

  test('manifest and generated registry expose both read-only ledger reports', () => {
    expect(manifest.version).toBe(19);
    for (const action of [
      'accounting_trial_balance_report',
      'accounting_financial_statements_report'
    ]) {
      const entry = manifest.capabilities.find(item => item.action === action);
      expect(entry).toBeTruthy();
      expect(entry.side_effect).toBe('database_read');
      expect(generated.capabilities[action]).toBeTruthy();
      expect(generated.capabilities[action].active).toBe(true);
      expect(typeof RUNTIME_ADAPTERS[action]).toBe('function');
      expect(router).toContain("'"+action+"'");
    }
  });

  test('financial statements require explicit reporting period', () => {
    const entry = generated.capabilities.accounting_financial_statements_report;
    expect(entry.required).toEqual(['accounting_entity_id','from','to']);
  });

  test('migration fails closed and activates only the two verified services', () => {
    expect(migration).toContain('if candidate_count <> 2 then');
    expect(migration).toContain('if mapped_count <> 0 then');
    expect(migration).toContain("'trial_balance','accounting_trial_balance_report'");
    expect(migration).toContain("'financial_statements','accounting_financial_statements_report'");
    expect(migration).toContain("execution_status='automated'");
  });
});
