'use strict';

const fs = require('fs');
const path = require('path');
const {
  CAPABILITIES
} = require('../../lib/capabilities/bonds-capability-registry');
const {
  RUNTIME_ADAPTERS
} = require('../../lib/capabilities/runtime-adapters');

const ROUTER = fs.readFileSync(
  path.join(__dirname, '../../lib/services/service-execution-router.js'),
  'utf8'
);
const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026031500_accounting_service_execution.sql'),
  'utf8'
);

const ACTIONS = [
  'accounting_dimension_create',
  'accounting_period_transition',
  'accounting_asset_create',
  'accounting_collateral_assign',
  'accounting_depreciation_policy_configure',
  'accounting_depreciation_post'
];

describe('Wave 10 accounting service execution', () => {
  test('registers every accounting operation in the governed capability registry', () => {
    for (const action of ACTIONS) {
      expect(CAPABILITIES[action]).toBeDefined();
      expect(CAPABILITIES[action].active).toBe(true);
      expect(CAPABILITIES[action].serviceCode).toBe('financial-engine');
      expect(typeof RUNTIME_ADAPTERS[CAPABILITIES[action].runtime.adapter]).toBe('function');
    }
  });

  test('routes requested action only when mapped to the selected service', () => {
    expect(ROUTER).toContain("const requestedAction = String(body.action || '').trim() || null");
    expect(ROUTER).toContain('mappedActions.has(requestedAction)');
    expect(ROUTER).toContain('SERVICE_ACTION_NOT_MAPPED');
    expect(ROUTER).toContain('ACCOUNTING_OPERATION_ACTIONS.has(executionAction)');
  });

  test('creates one accounting_operations service on the existing execution boundary', () => {
    expect(MIGRATION).toContain("'accounting_operations'");
    expect(MIGRATION).toContain("'capability_plan'");
    expect(MIGRATION).toContain("'automated'");
    expect(MIGRATION).toContain("'mapped_actions_only',true");
    expect(MIGRATION).not.toMatch(/create table/i);
  });

  test('maps all six accounting actions without inventing a parallel endpoint', () => {
    for (const action of ACTIONS) {
      expect(MIGRATION).toContain("'" + action + "'");
    }
    expect(ROUTER).not.toContain('/services/accounting/execute');
  });

  test('runtime adapters enforce accounting entity membership before writes', () => {
    const runtime = fs.readFileSync(
      path.join(__dirname, '../../lib/capabilities/runtime-adapters.js'),
      'utf8'
    );
    expect(runtime).toContain("from('accounting_entity_members')");
    expect(runtime).toContain("eq('user_id', context.userId)");
    expect(runtime).toContain("eq('status', 'active')");
    expect(runtime).toContain('ACCOUNTING_ENTITY_ACCESS_DENIED');
    expect(runtime).toContain("['owner','admin','accountant']");
  });
});
