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
    '../../supabase/migrations/20261026050000_accounting_year_end_close.sql'
  ),
  'utf8'
);
const STORE = fs.readFileSync(
  path.join(
    __dirname,
    '../../lib/finance/accounting/supabase-accounting-year-end-store.js'
  ),
  'utf8'
);
const ROUTER = fs.readFileSync(
  path.join(__dirname, '../../lib/services/service-execution-router.js'),
  'utf8'
);

describe('Wave 13 governed year-end close', () => {
  test('requires explicit retained earnings and fiscal calendar policy', () => {
    expect(MIGRATION).toContain(
      'create table if not exists public.accounting_year_end_policies'
    );
    expect(MIGRATION).toContain('retained_earnings_account_id');
    expect(MIGRATION).toContain('fiscal_year_end_month');
    expect(MIGRATION).toContain('fiscal_year_end_day');
    expect(MIGRATION).toContain(
      'ACCOUNTING_RETAINED_EARNINGS_ACCOUNT_REQUIRED'
    );
  });

  test('requires complete contiguous fiscal-year period coverage', () => {
    expect(MIGRATION).toContain(
      'ACCOUNTING_YEAR_END_PERIODS_NOT_CONTIGUOUS'
    );
    expect(MIGRATION).toContain(
      'ACCOUNTING_YEAR_END_PERIOD_COVERAGE_INVALID'
    );
    expect(MIGRATION).toContain(
      'ACCOUNTING_YEAR_END_PRIOR_PERIODS_NOT_CLOSED'
    );
  });

  test('closes temporary accounts through canonical posting and period workflows', () => {
    expect(MIGRATION).toContain(
      "a.account_type in (\n        'revenue','contra_revenue','expense','contra_expense'"
    );
    expect(MIGRATION).toContain(
      'public.accounting_commit_posting(v_event,v_posting)'
    );
    expect(MIGRATION).toContain(
      "public.accounting_transition_period(\n    p_accounting_entity_id"
    );
    expect(MIGRATION).toContain("'close'");
  });

  test('generic close and reopen cannot bypass configured year-end workflow', () => {
    expect(MIGRATION).toContain(
      'ACCOUNTING_YEAR_END_CLOSE_WORKFLOW_REQUIRED'
    );
    expect(MIGRATION).toContain(
      'ACCOUNTING_YEAR_END_REOPEN_WORKFLOW_REQUIRED'
    );
  });

  test('reopen reverses the closing journal atomically', () => {
    expect(MIGRATION).toContain(
      'create or replace function public.accounting_reopen_year_end'
    );
    expect(MIGRATION).toContain("'reopening'");
    expect(MIGRATION).toContain("'reversed'");
    expect(MIGRATION).toContain('reversal_of=v_original_journal.id');
    expect(MIGRATION).toContain(
      'public.accounting_commit_posting(v_event,v_posting)'
    );
  });

  test('uses explicit pgcrypto schema for year-end idempotency', () => {
    expect(MIGRATION).toContain('extensions.digest(');
    expect(MIGRATION).not.toContain('search_path = public, extensions');
  });

  test('keeps year-end tables server mediated', () => {
    expect(MIGRATION).toContain(
      'alter table public.accounting_year_end_policies enable row level security'
    );
    expect(MIGRATION).toContain(
      'alter table public.accounting_year_end_close_runs enable row level security'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_year_end_policies from anon, authenticated'
    );
  });

  test('registers all Wave 13 actions in governed runtime', () => {
    for (const action of [
      'accounting_year_end_policy_configure',
      'accounting_year_end_close',
      'accounting_year_end_reopen'
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

  test('store uses only governed year-end RPCs', () => {
    expect(STORE).toContain("'accounting_configure_year_end_policy'");
    expect(STORE).toContain("'accounting_execute_year_end_close'");
    expect(STORE).toContain("'accounting_reopen_year_end'");
    expect(STORE).not.toContain("from('accounting_journal_lines')");
  });
});
