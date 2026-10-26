'use strict';

const fs = require('fs');
const path = require('path');
const generated = require('../../lib/capabilities/generated-service-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');
const {
  prepareAccountingAdjustment
} = require('../../lib/finance/accounting/accounting-adjustment');

describe('Accounting operations wave 24 adjustments', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(process.cwd(),'services/manifests/financial-engine.service.json'),
    'utf8'
  ).replace(/^\uFEFF/,''));

  const router = fs.readFileSync(
    path.join(process.cwd(),'lib/services/service-execution-router.js'),
    'utf8'
  );

  const migration = fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261027008000_accounting_adjustments_wave24.sql'),
    'utf8'
  );

  test('prepares governed accrual adjustment through canonical posting shape', () => {
    const posting = prepareAccountingAdjustment({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'adjustment-001',
      adjustment_type:'accrual',
      reason:'Month-end accrued expense',
      lines:[
        { account_code:'5100', debit:250, credit:0 },
        { account_code:'2100', debit:0, credit:250 }
      ]
    });

    expect(posting.event.type).toBe('accounting_adjustment_accrual');
    expect(posting.event.service_code).toBe('accounting_adjustments');
    expect(posting.journal.total_debit).toBe(250);
    expect(posting.journal.total_credit).toBe(250);
    expect(posting.event.payload.reason).toBe('Month-end accrued expense');
  });

  test('builds reversal deterministically from source journal lines', () => {
    const posting = prepareAccountingAdjustment({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-27T10:00:00Z',
      request_key:'reversal-001',
      adjustment_type:'reversal',
      source_journal_id:'00000000-0000-4000-8000-000000000099',
      reason:'Reverse incorrect posted entry'
    }, {
      sourceCurrency:'SAR',
      sourceJournalLines:[
        { account_code:'1100', debit:100, credit:0 },
        { account_code:'4000', debit:0, credit:100 }
      ]
    });

    expect(posting.journal.reversal_of).toBe('00000000-0000-4000-8000-000000000099');
    expect(posting.journal.lines[0]).toMatchObject({ account_code:'1100', debit:0, credit:100 });
    expect(posting.journal.lines[1]).toMatchObject({ account_code:'4000', debit:100, credit:0 });
    expect(posting.event.payload.source_journal_id).toBe('00000000-0000-4000-8000-000000000099');
  });

  test('fails closed on unsupported adjustment and unbalanced lines', () => {
    expect(() => prepareAccountingAdjustment({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'bad-type',
      adjustment_type:'guess',
      reason:'No guessing',
      lines:[]
    })).toThrow('ACCOUNTING_ADJUSTMENT_TYPE_INVALID');

    expect(() => prepareAccountingAdjustment({
      accounting_entity_id:'00000000-0000-4000-8000-000000000001',
      effective_at:'2026-10-26T10:00:00Z',
      request_key:'bad-balance',
      adjustment_type:'correction',
      source_journal_id:'00000000-0000-4000-8000-000000000099',
      reason:'Correction',
      lines:[
        { account_code:'1100', debit:100, credit:0 },
        { account_code:'4000', debit:0, credit:90 }
      ]
    })).toThrow('JOURNAL_NOT_BALANCED');
  });

  test('registers Wave 24 capability on the existing financial service', () => {
    const entry = manifest.capabilities.find(
      item => item.action === 'accounting_adjustment_post'
    );
    expect(manifest.version).toBe(21);
    expect(entry).toBeTruthy();
    expect(entry.id).toBe('BONDS-CAP-FIN-045');
    expect(entry.side_effect).toBe('database_write');
    expect(generated.capabilities.accounting_adjustment_post).toBeTruthy();
    expect(typeof RUNTIME_ADAPTERS.accounting_adjustment_post).toBe('function');
    expect(router).toContain("'accounting_adjustment_post'");
  });

  test('migration activates only accounting_adjustments and adds no parallel accounting infrastructure', () => {
    expect(migration).toContain('if candidate_count <> 1 then');
    expect(migration).toContain('if mapped_count <> 0 then');
    expect(migration).toContain("'accounting_adjustments'");
    expect(migration).toContain("'accounting_adjustment_post'");
    expect(migration).toContain('uq_accounting_journal_entries_reversal_of');
    expect(migration).toContain('create or replace function public.accounting_commit_posting');
    expect(migration).toContain('reversal_of');
    expect(migration).toContain('ACCOUNTING_REVERSAL_SOURCE_NOT_POSTED');
    expect(migration.toLowerCase()).not.toContain('create table');
    expect((migration.match(/create or replace function/gi) || [])).toHaveLength(1);
  });
});
