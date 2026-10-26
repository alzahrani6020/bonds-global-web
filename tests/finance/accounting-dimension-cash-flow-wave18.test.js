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
    '../../supabase/migrations/20261027003000_accounting_dimension_cash_flow_wave18.sql'
  ),
  'utf8'
);

describe('Accounting Reporting Wave 18 cash-flow statement', () => {
  test('reuses canonical cash-account and classification policy tables', () => {
    expect(MIGRATION).toContain('public.accounting_cash_accounts');
    expect(MIGRATION).toContain('public.accounting_cash_flow_policies');
    expect(MIGRATION).not.toContain(
      'create table if not exists public.accounting_cash_accounts'
    );
    expect(MIGRATION).not.toContain(
      'create table if not exists public.accounting_cash_flow_policies'
    );
  });

  test('fails closed on missing dimensions and classifications', () => {
    expect(MIGRATION).toContain('CASH_FLOW_DIMENSION_REQUIRED');
    expect(MIGRATION).toContain('CASH_FLOW_CLASSIFICATION_REQUIRED');
  });

  test('computes three cash-flow categories and reconciliation in PostgreSQL', () => {
    expect(MIGRATION).toContain("'operating'::text");
    expect(MIGRATION).toContain("'investing'::text");
    expect(MIGRATION).toContain("'financing'::text");
    expect(MIGRATION).toContain('opening_cash');
    expect(MIGRATION).toContain('net_cash_change');
    expect(MIGRATION).toContain('closing_cash');
    expect(MIGRATION).toContain('direct_closing_cash');
    expect(MIGRATION).toContain('reconciliation_delta');
  });

  test('promotes existing cash_flow_statement service', () => {
    expect(MIGRATION).toContain("'cash_flow_statement'");
    expect(MIGRATION).toContain(
      "'accounting_dimension_cash_flow_statement'"
    );
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'capability_plan'");
  });

  test('registers all Wave 18 governed capabilities', () => {
    for (const action of [
      'accounting_cash_account_configure',
      'accounting_cash_flow_policy_configure',
      'accounting_dimension_cash_flow_statement'
    ]) {
      expect(CAPABILITIES[action]).toBeDefined();
      expect(CAPABILITIES[action].active).toBe(true);
      expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
      expect(
        typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter]
      ).toBe('function');
    }
  });

  test('new database functions are invoker-only and service-role scoped', () => {
    expect(MIGRATION.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(3);
    expect(MIGRATION).toContain('from public, anon, authenticated');
    expect(MIGRATION).toContain('to service_role');
  });
});
