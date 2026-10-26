'use strict';

const fs = require('fs');
const path = require('path');
const {
  CAPABILITIES
} = require('../../lib/capabilities/bonds-capability-registry');
const {
  RUNTIME_ADAPTERS
} = require('../../lib/capabilities/runtime-adapters');

const MIGRATION = fs.readFileSync(
  path.join(
    __dirname,
    '../../supabase/migrations/20261026051500_accounting_dimension_ledger_report.sql'
  ),
  'utf8'
);
const STORE = fs.readFileSync(
  path.join(
    __dirname,
    '../../lib/finance/accounting/supabase-accounting-report-store.js'
  ),
  'utf8'
);
const ROUTER = fs.readFileSync(
  path.join(__dirname, '../../lib/services/service-execution-router.js'),
  'utf8'
);

describe('Accounting Reporting Wave 14 dimension ledger', () => {
  test('reads only canonical posted journal sources', () => {
    expect(MIGRATION).toContain('public.accounting_journal_entries');
    expect(MIGRATION).toContain('public.accounting_journal_lines');
    expect(MIGRATION).toContain('public.accounting_accounts');
    expect(MIGRATION).toContain('public.accounting_dimensions');
    expect(MIGRATION).toContain("j.status='posted'");
    expect(MIGRATION).not.toContain('create table if not exists public.accounting_dimension_report');
  });

  test('supports only canonical cost-center and segment dimensions', () => {
    expect(MIGRATION).toContain("('cost_center','segment')");
    expect(MIGRATION).toContain('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    expect(STORE).toContain("['cost_center','segment']");
  });

  test('returns debit credit and net balance by dimension and account', () => {
    expect(MIGRATION).toContain('dimension_code text');
    expect(MIGRATION).toContain('dimension_name text');
    expect(MIGRATION).toContain('account_code text');
    expect(MIGRATION).toContain('debit numeric');
    expect(MIGRATION).toContain('credit numeric');
    expect(MIGRATION).toContain('net_balance numeric');
    expect(MIGRATION).toContain('sum(l.debit-l.credit)');
  });

  test('promotes existing general_ledger service through capability_plan', () => {
    expect(MIGRATION).toContain("'general_ledger'");
    expect(MIGRATION).toContain("'accounting_dimension_ledger_report'");
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'capability_plan'");
    expect(MIGRATION).toContain("'none'");
  });

  test('registers read-only governed runtime capability', () => {
    const action = 'accounting_dimension_ledger_report';
    expect(CAPABILITIES[action]).toBeDefined();
    expect(CAPABILITIES[action].active).toBe(true);
    expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
    expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter])
      .toBe('function');
    expect(ROUTER).toContain("'accounting_dimension_ledger_report'");
  });

  test('store calls only the governed report RPC', () => {
    expect(STORE).toContain("'accounting_dimension_ledger_balances'");
    expect(STORE).not.toContain("from('accounting_journal_lines')");
  });
});
