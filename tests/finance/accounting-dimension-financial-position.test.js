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
    '../../supabase/migrations/20261026234500_accounting_dimension_financial_position.sql'
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

describe('Accounting Reporting Wave 16 dimension financial position', () => {
  test('reads only posted canonical journal data', () => {
    expect(MIGRATION).toContain("j.status='posted'");
    expect(MIGRATION).toContain(
      "'asset','contra_asset',"
    );
    expect(MIGRATION).toContain(
      "'liability','contra_liability',"
    );
    expect(MIGRATION).toContain(
      "'equity','contra_equity'"
    );
    expect(MIGRATION).not.toContain(
      'create table if not exists public.accounting_financial_position'
    );
  });

  test('uses balance-sheet sign conventions', () => {
    expect(MIGRATION).toContain(
      "when 'asset' then coalesce(sum(l.debit-l.credit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'contra_asset' then coalesce(sum(l.credit-l.debit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'liability' then coalesce(sum(l.credit-l.debit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'contra_liability' then coalesce(sum(l.debit-l.credit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'equity' then coalesce(sum(l.credit-l.debit),0)"
    );
    expect(MIGRATION).toContain(
      "when 'contra_equity' then coalesce(sum(l.debit-l.credit),0)"
    );
  });

  test('includes current-period earnings without persisting a parallel account', () => {
    expect(MIGRATION).toContain("'current_period_earnings'::text");
    expect(MIGRATION).toContain("'CURRENT_PERIOD_EARNINGS'::text");
    expect(MIGRATION).toContain(
      "'revenue','contra_revenue','expense','contra_expense'"
    );
    expect(MIGRATION).toContain(
      'coalesce(sum(l.credit-l.debit),0)::numeric as amount'
    );
    expect(MIGRATION).not.toContain(
      "insert into public.accounting_accounts"
    );
  });

  test('computes balance-sheet totals and balance delta inside PostgreSQL', () => {
    for (const field of [
      'gross_assets',
      'contra_assets_total',
      'net_assets',
      'gross_liabilities',
      'contra_liabilities_total',
      'net_liabilities',
      'gross_equity',
      'contra_equity_total',
      'current_period_earnings',
      'net_equity',
      'liabilities_and_equity',
      'balance_delta'
    ]) {
      expect(MIGRATION).toContain(field);
    }
    expect(MIGRATION).toContain(
      'over(partition by r.dimension_code)'
    );
  });

  test('promotes the existing statement_financial_position service', () => {
    expect(MIGRATION).toContain("'statement_financial_position'");
    expect(MIGRATION).toContain(
      "'accounting_dimension_financial_position'"
    );
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'capability_plan'");
  });

  test('registers governed read-only capability', () => {
    const action = 'accounting_dimension_financial_position';
    expect(CAPABILITIES[action]).toBeDefined();
    expect(CAPABILITIES[action].active).toBe(true);
    expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
    expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter])
      .toBe('function');
    expect(ROUTER).toContain(
      "'accounting_dimension_financial_position'"
    );
  });

  test('store uses only the governed financial-position RPC', () => {
    expect(STORE).toContain(
      "'accounting_dimension_financial_position_rows'"
    );
    expect(STORE).not.toContain(
      "from('accounting_journal_lines')"
    );
  });

  test('RPC is invoker-only and service-role scoped', () => {
    expect(MIGRATION).toContain('security invoker');
    expect(MIGRATION).toContain(
      'from public, anon, authenticated'
    );
    expect(MIGRATION).toContain('to service_role');
  });
});
