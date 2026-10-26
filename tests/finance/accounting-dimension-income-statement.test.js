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
    '../../supabase/migrations/20261026053000_accounting_dimension_income_statement.sql'
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

describe('Accounting Reporting Wave 15 dimension income statement', () => {
  test('reads only posted temporary income-statement accounts', () => {
    expect(MIGRATION).toContain("j.status='posted'");
    expect(MIGRATION).toContain(
      "'revenue','contra_revenue','expense','contra_expense'"
    );
    expect(MIGRATION).not.toContain(
      'create table if not exists public.accounting_income_statement'
    );
  });

  test('uses accounting sign conventions for each statement class', () => {
    expect(MIGRATION).toContain(
      "when 'revenue' then coalesce(sum(l.credit-l.debit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'contra_revenue' then coalesce(sum(l.debit-l.credit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'expense' then coalesce(sum(l.debit-l.credit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'contra_expense' then coalesce(sum(l.credit-l.debit),0)"
    );
  });

  test('computes statement totals inside PostgreSQL', () => {
    for (const field of [
      'gross_revenue',
      'contra_revenue_total',
      'net_revenue',
      'gross_expense',
      'contra_expense_total',
      'net_expense',
      'net_income'
    ]) {
      expect(MIGRATION).toContain(field);
    }
    expect(MIGRATION).toContain('over(partition by r.dimension_code)');
  });

  test('promotes existing income_statement service', () => {
    expect(MIGRATION).toContain("'income_statement'");
    expect(MIGRATION).toContain("'accounting_dimension_income_statement'");
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'capability_plan'");
  });

  test('registers governed read-only capability', () => {
    const action = 'accounting_dimension_income_statement';
    expect(CAPABILITIES[action]).toBeDefined();
    expect(CAPABILITIES[action].active).toBe(true);
    expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
    expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter])
      .toBe('function');
    expect(ROUTER).toContain("'accounting_dimension_income_statement'");
  });

  test('store uses only the governed statement RPC', () => {
    expect(STORE).toContain("'accounting_dimension_income_statement_rows'");
    expect(STORE).not.toContain("from('accounting_journal_lines')");
  });
});
