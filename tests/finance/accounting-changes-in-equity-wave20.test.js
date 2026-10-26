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
    '../../supabase/migrations/20261027005000_accounting_changes_in_equity_wave20.sql'
  ),
  'utf8'
);

describe('Accounting Reporting Wave 20 changes in equity', () => {
  test('uses explicit equity movement policy and fails closed', () => {
    expect(MIGRATION).toContain(
      'public.accounting_equity_movement_policies'
    );
    expect(MIGRATION).toContain(
      'EQUITY_MOVEMENT_CLASSIFICATION_REQUIRED'
    );
  });

  test('reports all required equity movement categories', () => {
    for (const value of [
      'capital_contribution',
      'distribution',
      'other_equity',
      'current_period_earnings'
    ]) {
      expect(MIGRATION).toContain(value);
    }
  });

  test('reconciles computed equity to direct canonical ledger equity', () => {
    expect(MIGRATION).toContain('opening_equity');
    expect(MIGRATION).toContain('closing_equity');
    expect(MIGRATION).toContain('direct_closing_equity');
    expect(MIGRATION).toContain('reconciliation_delta');
  });

  test('excludes year-end close source from movement and earnings categories', () => {
    expect(MIGRATION).toContain(
      "coalesce(source_system,'') <> 'accounting_year_end'"
    );
  });

  test('promotes the existing changes_in_equity service', () => {
    expect(MIGRATION).toContain("'changes_in_equity'");
    expect(MIGRATION).toContain(
      "'accounting_changes_in_equity_statement'"
    );
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'capability_plan'");
  });

  test('registers both governed Wave 20 capabilities', () => {
    for (const action of [
      'accounting_equity_movement_policy_configure',
      'accounting_changes_in_equity_statement'
    ]) {
      expect(CAPABILITIES[action]).toBeDefined();
      expect(CAPABILITIES[action].active).toBe(true);
      expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
      expect(
        typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter]
      ).toBe('function');
    }
  });

  test('new functions are invoker-only and service-role scoped', () => {
    expect(MIGRATION.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(2);
    expect(MIGRATION).toContain('from public,anon,authenticated');
    expect(MIGRATION).toContain('to service_role');
  });
});
