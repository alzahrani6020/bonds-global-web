'use strict';

const fs = require('fs');
const path = require('path');
const generated = require('../../lib/capabilities/generated-service-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');
const {
  normalizeBankRows,
  reconcileBankRows
} = require('../../lib/finance/accounting/bank-reconciliation-engine');

describe('Bank reconciliation V1', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(process.cwd(),'services/manifests/financial-engine.service.json'),
    'utf8'
  ).replace(/^\uFEFF/,''));

  const router = fs.readFileSync(
    path.join(process.cwd(),'lib/services/service-execution-router.js'),
    'utf8'
  );

  const migration = fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261027010000_bank_reconciliation_v1.sql'),
    'utf8'
  );

  test('normalizes bank rows deterministically', () => {
    const rows = normalizeBankRows([
      {
        date:'2026-10-20',
        amount:100,
        currency:'sar',
        reference:'TRX-001',
        description:'Customer payment'
      }
    ], {
      requestKey:'bank-import-001',
      defaultCurrency:'SAR'
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source_id:'bank-import-001:1',
      bank_date:'2026-10-20',
      amount:100,
      currency:'SAR',
      normalized_reference:'TRX001'
    });
    expect(rows[0].source_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  test('auto-matches only one unambiguous exact reference and amount', () => {
    const bankRows = normalizeBankRows([
      { source_id:'row-1', date:'2026-10-20', amount:100, reference:'TRX-001' }
    ], { requestKey:'bank-import-002' });

    const result = reconcileBankRows({
      bankRows,
      ledgerRows:[
        {
          journal_entry_id:'00000000-0000-4000-8000-000000000001',
          journal_line_id:'00000000-0000-4000-8000-000000000011',
          effective_at:'2026-10-19',
          amount:100,
          currency:'SAR',
          reference:'TRX001'
        }
      ]
    });

    expect(result.summary).toEqual({
      total:1,
      matched:1,
      variance:0,
      unmatched:0
    });
    expect(result.rows[0]).toMatchObject({
      status:'matched',
      match_method:'exact_reference_amount',
      match_confidence:1,
      candidate_journal_line_id:'00000000-0000-4000-8000-000000000011'
    });
  });

  test('keeps probable date-window match for review instead of auto-matching', () => {
    const bankRows = normalizeBankRows([
      { source_id:'row-2', date:'2026-10-20', amount:-75, reference:'' }
    ], { requestKey:'bank-import-003' });

    const result = reconcileBankRows({
      bankRows,
      ledgerRows:[
        {
          journal_entry_id:'00000000-0000-4000-8000-000000000002',
          journal_line_id:'00000000-0000-4000-8000-000000000022',
          effective_at:'2026-10-22',
          amount:-75,
          currency:'SAR',
          reference:''
        }
      ]
    });

    expect(result.rows[0]).toMatchObject({
      status:'unmatched',
      match_method:'probable_amount_date_window',
      match_confidence:0.7
    });
  });

  test('fails closed on ambiguous exact amount/date', () => {
    const bankRows = normalizeBankRows([
      { source_id:'row-3', date:'2026-10-20', amount:50 }
    ], { requestKey:'bank-import-004' });

    const result = reconcileBankRows({
      bankRows,
      ledgerRows:[
        {
          journal_entry_id:'00000000-0000-4000-8000-000000000003',
          journal_line_id:'00000000-0000-4000-8000-000000000031',
          effective_at:'2026-10-20',
          amount:50,
          currency:'SAR'
        },
        {
          journal_entry_id:'00000000-0000-4000-8000-000000000004',
          journal_line_id:'00000000-0000-4000-8000-000000000041',
          effective_at:'2026-10-20',
          amount:50,
          currency:'SAR'
        }
      ]
    });

    expect(result.rows[0]).toMatchObject({
      status:'unmatched',
      match_method:'ambiguous',
      match_confidence:0
    });
  });

  test('registers FIN-050 on financial-engine v23', () => {
    expect(manifest.version).toBe(23);
    const entry = manifest.capabilities.find(
      item => item.action === 'accounting_bank_reconciliation_run'
    );
    expect(entry).toBeTruthy();
    expect(entry.id).toBe('BONDS-CAP-FIN-050');
    expect(entry.side_effect).toBe('database_write');
    expect(generated.capabilities.accounting_bank_reconciliation_run?.id)
      .toBe('BONDS-CAP-FIN-050');
    expect(typeof RUNTIME_ADAPTERS.accounting_bank_reconciliation_run)
      .toBe('function');
    expect(router).toContain("'accounting_bank_reconciliation_run'");
  });

  test('migration extends existing reconciliation surface without parallel ledger', () => {
    expect(migration).toContain("s.code='bank_reconciliation'");
    expect(migration).toContain("primary_action='accounting_bank_reconciliation_run'");
    expect(migration).toContain("'bank_statement'::text");
    expect(migration).toContain('uq_finance_reconciliation_matched_ledger_line');
    expect(migration).toContain('finance_reconciliation_matched_evidence_check');
    expect(migration).toContain('"auto_match_policy":"exact_only"');
    expect(migration).toContain('"bank_feed":"normalized_import"');
    expect(migration.toLowerCase()).not.toContain('create table');
    expect(migration.toLowerCase()).not.toContain('security definer');
  });
});
