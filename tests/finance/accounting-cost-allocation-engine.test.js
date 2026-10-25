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
    '../../supabase/migrations/20261026041500_accounting_cost_allocation_engine.sql'
  ),
  'utf8'
);
const STORE = fs.readFileSync(
  path.join(
    __dirname,
    '../../lib/finance/accounting/supabase-accounting-allocation-store.js'
  ),
  'utf8'
);
const ROUTER = fs.readFileSync(
  path.join(__dirname, '../../lib/services/service-execution-router.js'),
  'utf8'
);

describe('Wave 12 governed cost allocation engine', () => {
  test('uses normalized governed rule and target tables without parallel ledger tables', () => {
    expect(MIGRATION).toContain(
      'create table if not exists public.accounting_allocation_rules'
    );
    expect(MIGRATION).toContain(
      'create table if not exists public.accounting_allocation_targets'
    );
    expect(MIGRATION).toContain(
      'references public.accounting_accounts(accounting_entity_id, id)'
    );
    expect(MIGRATION).not.toContain(
      'create table if not exists public.accounting_allocation_journal'
    );
  });

  test('requires deterministic 100 percent basis-point allocation', () => {
    expect(MIGRATION).toContain("'fixed_percentage'");
    expect(MIGRATION).toContain(
      'ACCOUNTING_ALLOCATION_WEIGHTS_MUST_EQUAL_10000'
    );
    expect(MIGRATION).toContain('v_total_weight <> 10000');
    expect(MIGRATION).toContain('weight_basis_points');
  });

  test('routes every execution through the canonical atomic posting RPC', () => {
    expect(MIGRATION).toContain(
      'public.accounting_commit_posting(v_event,v_posting)'
    );
    expect(MIGRATION).toContain("'cost.allocation'");
    expect(MIGRATION).toContain("'cost_allocation'");
    expect(MIGRATION).toContain("'accounting_operations'");
  });

  test('reuses canonical dimension and mandatory policy validation', () => {
    expect(MIGRATION).toContain(
      'create or replace function public.accounting_assert_account_dimensions'
    );
    expect(MIGRATION).toContain(
      'ACCOUNTING_REQUIRED_DIMENSION_MISSING'
    );
    expect(MIGRATION).toContain(
      'perform public.accounting_assert_account_dimensions'
    );
  });

  test('keeps allocation tables server mediated', () => {
    expect(MIGRATION).toContain(
      'alter table public.accounting_allocation_rules enable row level security'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_allocation_rules from anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_allocation_targets from anon, authenticated'
    );
  });

  test('registers configure and execute actions in the governed runtime', () => {
    for (const action of [
      'accounting_allocation_rule_configure',
      'accounting_allocation_execute'
    ]) {
      expect(CAPABILITIES[action]).toBeDefined();
      expect(CAPABILITIES[action].active).toBe(true);
      expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
      expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter])
        .toBe('function');
      expect(ROUTER).toContain(`'${action}'`);
    }
    expect(ROUTER).not.toContain('/services/accounting/execute');
  });

  test('store calls only the governed allocation RPCs', () => {
    expect(STORE).toContain("'accounting_configure_allocation_rule'");
    expect(STORE).toContain("'accounting_execute_allocation'");
    expect(STORE).not.toContain("from('accounting_journal_lines')");
  });
});
