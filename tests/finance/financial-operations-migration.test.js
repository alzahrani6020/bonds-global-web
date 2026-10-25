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
    expect(sql).toContain('security invoker');
    expect(sql).not.toContain('security definer');
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
    expect(sql).toContain(
      'grant select, insert, update, delete on public.accounting_journal_entries to service_role;'
    );
    expect(sql).toContain(
      'foreign key (accounting_entity_id, account_id)'
    );
    expect(sql).toContain(
      'foreign key (accounting_entity_id, journal_entry_id)'
    );
    expect(sql).toContain(
      'foreign key (accounting_entity_id, financial_event_id)'
    );
    expect(sql).toContain(
      'foreign key (accounting_entity_id, period_id)'
    );
    expect(sql).toContain(
      'foreign key (accounting_entity_id, reversal_of)'
    );
    expect(sql).toContain('security invoker');
    expect(sql).not.toContain('security definer');
  });
  test('advisor hardening covers financial foreign-key access paths', () => {
    const sql = migration('20261025213000_financial_operations_index_hardening.sql');
    for (const indexName of [
      'idx_accounting_accounts_entity_parent',
      'idx_accounting_entities_created_by',
      'idx_accounting_journal_entries_entity_period',
      'idx_accounting_journal_entries_entity_reversal',
      'idx_accounting_journal_entries_posted_by',
      'idx_accounting_journal_lines_entity_account_id',
      'idx_accounting_journal_lines_entity_entry',
      'idx_accounting_periods_closed_by'
    ]) {
      expect(sql).toContain(indexName);
    }
    expect((sql.match(/create index if not exists/g) || []).length).toBe(8);
  });
  test('ledger reporting RPC remains service-role only and security invoker', () => {
    const sql = migration('20261025220000_accounting_ledger_reporting_rpc.sql');
    expect(sql).toContain('security invoker');
    expect(sql).not.toContain('security definer');
    expect(sql).toContain(
      'revoke all on function public.accounting_ledger_balances(uuid,date,date) from anon, authenticated;'
    );
    expect(sql).toContain(
      'grant execute on function public.accounting_ledger_balances(uuid,date,date) to service_role;'
    );
    expect(sql).toContain("j.status = 'posted'");
    expect(sql).toContain('ACCOUNTING_ENTITY_NOT_ACTIVE');
    expect(sql).toContain('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
  });
});
