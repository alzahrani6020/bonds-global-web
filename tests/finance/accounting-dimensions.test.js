'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeDimensionObject,
  applyLineDimensions
} = require('../../lib/finance/accounting/accounting-dimensions');
const {
  SupabaseAccountingDimensionStore
} = require('../../lib/finance/accounting/supabase-accounting-dimension-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026024500_governed_accounting_dimensions.sql'),
  'utf8'
);

describe('governed accounting dimensions', () => {
  test('reuses journal line dimensions and creates one canonical dimension master', () => {
    expect(MIGRATION).toContain('create table if not exists public.accounting_dimensions');
    expect(MIGRATION).toContain('on public.accounting_journal_lines');
    expect(MIGRATION).not.toMatch(/create table if not exists public\.accounting_journal_dimensions/i);
  });

  test('supports cost centers and segments only', () => {
    expect(MIGRATION).toContain("dimension_type in ('cost_center','segment')");
    expect(normalizeDimensionObject({cost_center:'CC-100',segment:'SME'}))
      .toEqual({cost_center:'CC-100',segment:'SME'});
    expect(() => normalizeDimensionObject({region:'west'}))
      .toThrow('ACCOUNTING_DIMENSION_KEY_UNSUPPORTED');
  });

  test('fails closed for unknown or inactive dimension codes in database trigger', () => {
    expect(MIGRATION).toContain('ACCOUNTING_DIMENSION_NOT_ACTIVE_OR_NOT_FOUND');
    expect(MIGRATION).toContain("d.status = 'active'");
    expect(MIGRATION).toContain('d.accounting_entity_id = new.accounting_entity_id');
  });

  test('dimension master is server-mediated', () => {
    expect(MIGRATION).toContain('revoke all on public.accounting_dimensions from anon, authenticated');
    expect(MIGRATION).toContain('on public.accounting_dimensions to service_role');
  });

  test('applies dimensions explicitly to selected lines only', () => {
    const posting = {
      journal:{
        lines:[
          {line_no:1,account_code:'1100',debit:100,credit:0},
          {line_no:2,account_code:'4100',debit:0,credit:100}
        ]
      }
    };

    const result = applyLineDimensions(posting,[
      {line_no:2,dimensions:{cost_center:'CC-SALES',segment:'SME'}}
    ]);

    expect(result.journal.lines[0].dimensions).toBeUndefined();
    expect(result.journal.lines[1].dimensions).toEqual({
      cost_center:'CC-SALES',
      segment:'SME'
    });
    expect(posting.journal.lines[1].dimensions).toBeUndefined();
  });

  test('does not guess missing line or unsupported dimensions', () => {
    const posting = {journal:{lines:[{line_no:1}]}};
    expect(() => applyLineDimensions(posting,[
      {line_no:2,dimensions:{cost_center:'CC-1'}}
    ])).toThrow('ACCOUNTING_DIMENSION_LINE_NOT_FOUND');

    expect(() => applyLineDimensions(posting,[
      {line_no:1,dimensions:{region:'west'}}
    ])).toThrow('ACCOUNTING_DIMENSION_KEY_UNSUPPORTED');
  });

  test('store rejects unsupported type before database write', async () => {
    const from = jest.fn();
    const store = new SupabaseAccountingDimensionStore({from});
    await expect(store.createDimension({
      accountingEntityId:'entity-1',
      dimensionType:'region',
      code:'R1',
      name:'West'
    })).rejects.toThrow('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    expect(from).not.toHaveBeenCalled();
  });
});
