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
    '../../supabase/migrations/20261026040000_accounting_mandatory_dimension_policies.sql'
  ),
  'utf8'
);
const STORE = fs.readFileSync(
  path.join(
    __dirname,
    '../../lib/finance/accounting/supabase-accounting-dimension-policy-store.js'
  ),
  'utf8'
);
const ROUTER = fs.readFileSync(
  path.join(__dirname, '../../lib/services/service-execution-router.js'),
  'utf8'
);

describe('Wave 11 mandatory accounting dimension policies', () => {
  test('creates one governed policy master linked to the canonical account master', () => {
    expect(MIGRATION).toContain(
      'create table if not exists public.accounting_account_dimension_policies'
    );
    expect(MIGRATION).toContain(
      'references public.accounting_accounts(accounting_entity_id, id)'
    );
    expect(MIGRATION).toContain(
      'unique(accounting_entity_id, account_id, dimension_type)'
    );
    expect(MIGRATION).not.toContain('create table if not exists public.accounting_journal');
  });

  test('fails closed when a required account dimension is missing', () => {
    expect(MIGRATION).toContain('ACCOUNTING_REQUIRED_DIMENSION_MISSING');
    expect(MIGRATION).toContain('p.account_id = new.account_id');
    expect(MIGRATION).toContain('p.required = true');
    expect(MIGRATION).toContain("p.status = 'active'");
    expect(MIGRATION).toContain(
      'before insert or update of accounting_entity_id, account_id, dimensions'
    );
  });

  test('keeps direct table writes server mediated', () => {
    expect(MIGRATION).toContain(
      'alter table public.accounting_account_dimension_policies enable row level security'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_account_dimension_policies from anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'on public.accounting_account_dimension_policies to service_role'
    );
  });

  test('registers one governed configure action on accounting_operations', () => {
    const action = 'accounting_dimension_policy_configure';
    expect(CAPABILITIES[action]).toBeDefined();
    expect(CAPABILITIES[action].active).toBe(true);
    expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
    expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter]).toBe('function');
    expect(MIGRATION).toContain("'accounting_operations'");
    expect(MIGRATION).toContain("'accounting_dimension_policy_configure'");
    expect(ROUTER).toContain("'accounting_dimension_policy_configure'");
    expect(ROUTER).not.toContain('/services/accounting/execute');
  });

  test('store upserts one policy identity and never accepts arbitrary dimension types', () => {
    expect(STORE).toContain(
      "onConflict:'accounting_entity_id,account_id,dimension_type'"
    );
    expect(STORE).toContain("['cost_center','segment']");
    expect(STORE).toContain('ACCOUNTING_DIMENSION_POLICY_TYPE_UNSUPPORTED');
  });
});
