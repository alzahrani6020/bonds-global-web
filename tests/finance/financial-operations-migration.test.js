'use strict';

const fs = require('fs');
const path = require('path');

function migration(name) {
  return fs.readFileSync(
    path.join(__dirname, '../../supabase/migrations', name),
    'utf8'
  );
}

describe('financial operations migrations', () => {
  test('posting RPC remains a single intact transaction/function definition', () => {
    const sql = migration('20261025204500_financial_posting_rpc.sql');
    expect((sql.match(/create or replace function public\.accounting_commit_posting/g) || []).length).toBe(1);
    expect((sql.match(/\bcommit;/g) || []).length).toBe(1);
    expect(sql).toContain("v_currency !~ '^[A-Z]{3}$'");
    expect(sql).toContain("v_idempotency !~ '^[0-9a-f]{64}$'");
    expect(sql).not.toContain("commit; then");
  });

  test('posting RPC is restricted to service role and validates account mappings', () => {
    const sql = migration('20261025204500_financial_posting_rpc.sql');
    expect(sql).toContain(
      'grant execute on function public.accounting_commit_posting(jsonb,jsonb) to service_role;'
    );
    expect(sql).toContain('ACCOUNTING_ACCOUNT_NOT_POSTABLE');
    expect(sql).toContain("v_period_status <> 'open'");
    expect(sql).toContain('POSTING_IDEMPOTENCY_CONFLICT');
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  test('core schema is server mediated and enforces balanced journal totals', () => {
    const sql = migration('20261025203000_financial_operations_core.sql');
    expect(sql).toContain('alter table public.accounting_journal_entries enable row level security;');
    expect(sql).toContain('revoke all on public.accounting_journal_entries from anon, authenticated;');
    expect(sql).toContain('check (total_debit = total_credit)');
    expect(sql).toContain("if v_status <> 'open' then");
    expect(sql).toContain('ACCOUNTING_PERIOD_NOT_OPEN');
  });
});
