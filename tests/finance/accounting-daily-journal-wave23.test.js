'use strict';

const fs = require('fs');
const path = require('path');
const generated = require('../../lib/capabilities/generated-service-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');
const {
  prepareManualJournalEntry
} = require('../../lib/finance/accounting/manual-journal-entry');

describe('Accounting operations wave 23 daily journal posting', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(process.cwd(),'services/manifests/financial-engine.service.json'),
    'utf8'
  ).replace(/^\uFEFF/,''));

  const router = fs.readFileSync(
    path.join(process.cwd(),'lib/services/service-execution-router.js'),
    'utf8'
  );

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027007000_accounting_daily_journal_wave23.sql'
    ),
    'utf8'
  );

  test('prepares a balanced deterministic manual journal without inventing accounts', () => {
    const posting = prepareManualJournalEntry({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'daily-entry-001',
      currency:'SAR',
      description:'Daily journal test',
      lines:[
        { account_code:'1100', debit:125.50, credit:0 },
        { account_code:'4000', debit:0, credit:125.50 }
      ]
    });

    expect(posting.journal.total_debit).toBe(125.5);
    expect(posting.journal.total_credit).toBe(125.5);
    expect(posting.journal.lines).toHaveLength(2);
    expect(posting.event.type).toBe('manual_journal_entry');
    expect(posting.event.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
    expect(posting.event.service_code).toBe('daily_journal_entries');
    expect(posting.event.payload.posting_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  test('same request key with changed posting yields a different event identity', () => {
    const base = {
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'daily-entry-idempotency',
      lines:[
        { account_code:'1100', debit:100, credit:0 },
        { account_code:'4000', debit:0, credit:100 }
      ]
    };
    const changed = {
      ...base,
      lines:[
        { account_code:'1100', debit:120, credit:0 },
        { account_code:'4000', debit:0, credit:120 }
      ]
    };

    const first = prepareManualJournalEntry(base);
    const second = prepareManualJournalEntry(changed);

    expect(first.idempotency_key).toBe(second.idempotency_key);
    expect(first.event_id).not.toBe(second.event_id);
  });

  test('fails closed on unbalanced journal input', () => {
    expect(() => prepareManualJournalEntry({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'daily-entry-bad',
      lines:[
        { account_code:'1100', debit:100, credit:0 },
        { account_code:'4000', debit:0, credit:90 }
      ]
    })).toThrow('JOURNAL_NOT_BALANCED');
  });

  test('registers one governed database-write capability on the existing financial service', () => {
    const entry = manifest.capabilities.find(
      item => item.action === 'accounting_journal_post'
    );
    expect(manifest.version).toBe(22);
    expect(entry).toBeTruthy();
    expect(entry.id).toBe('BONDS-CAP-FIN-044');
    expect(entry.side_effect).toBe('database_write');
    expect(generated.capabilities.accounting_journal_post).toBeTruthy();
    expect(typeof RUNTIME_ADAPTERS.accounting_journal_post).toBe('function');
    expect(router).toContain("'accounting_journal_post'");
  });

  test('migration fails closed and activates only daily_journal_entries', () => {
    expect(migration).toContain('if candidate_count <> 1 then');
    expect(migration).toContain('if mapped_count <> 0 then');
    expect(migration).toContain("'daily_journal_entries'");
    expect(migration).toContain("'accounting_journal_post'");
    expect(migration).toContain("execution_status = 'automated'");
    expect(migration.toLowerCase()).not.toContain('create table');
    expect(migration.toLowerCase()).not.toContain('create or replace function');
  });
});
