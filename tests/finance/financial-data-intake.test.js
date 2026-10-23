'use strict';

const {
  canonicalField,
  parseNumeric,
  requirementsFor,
  extractFinancialFields,
  validateDataset
} = require('../../lib/finance/financial-data-intake');

describe('financial data intake phase 1', () => {
  test('uses exact semantic aliases and does not guess ambiguous debt labels', () => {
    expect(canonicalField('إجمالي الدين')).toBe('total_debt');
    expect(canonicalField('إجمالي حقوق الملكية')).toBe('equity');
    expect(canonicalField('القروض')).toBeNull();
    expect(canonicalField('المديونية')).toBeNull();
  });

  test('normalizes Arabic digits and accounting negatives', () => {
    expect(parseNumeric('١٢٣٬٤٥٦')).toBe(123456);
    expect(parseNumeric('(1,250.50)')).toBe(-1250.5);
  });

  test('derives only service-required fields for debt-to-equity', () => {
    const required = requirementsFor({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      values: {}
    });
    expect(required.supported).toBe(true);
    expect(required.requirement_fields).toEqual(
      expect.arrayContaining(['total_debt', 'equity'])
    );
    expect(required.requirement_fields).not.toContain('revenue');
  });

  test('extracts debt and equity with provenance from tabular input', () => {
    const extracted = extractFinancialFields({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      parsed: {
        sheet_name: 'Financials',
        rows: [
          ['Financial statement','Value','Currency','Period'],
          ['Total debt','200000','SAR','2026'],
          ['Equity','100000','SAR','2026'],
          ['Revenue','999999','SAR','2026']
        ],
        text: ''
      }
    });

    expect(extracted.values).toEqual({ total_debt: 200000, equity: 100000 });
    expect(extracted.validation.valid).toBe(true);
    expect(extracted.validation.engine_preview.metrics.debt_to_equity).toBe(2);
    expect(extracted.provenance.total_debt[0]).toMatchObject({
      extraction_method: 'tabular_parser',
      sheet: 'Financials',
      row: 2,
      column: 2
    });
  });

  test('does not invent missing equity and exposes it for review', () => {
    const extracted = extractFinancialFields({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      parsed: { rows: [['Total debt','200000']], text: '' }
    });
    expect(extracted.values.total_debt).toBe(200000);
    expect(extracted.values.equity).toBeUndefined();
    expect(extracted.validation.valid).toBe(false);
    expect(extracted.validation.missing).toContain('equity_or_total_assets_and_total_liabilities');
    expect(extracted.fields.find(x => x.field === 'equity').status).toBe('missing');
  });

  test('marks conflicting extracted values instead of selecting one', () => {
    const extracted = extractFinancialFields({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      parsed: {
        rows: [
          ['Total debt','200000'],
          ['Total debt','210000'],
          ['Equity','100000']
        ],
        text: ''
      }
    });
    const debt = extracted.fields.find(x => x.field === 'total_debt');
    expect(debt.status).toBe('conflict');
    expect(debt.value).toBeNull();
    expect(extracted.values.total_debt).toBeUndefined();
  });

  test('flags accounting mismatch only when all three values are available', () => {
    const result = validateDataset({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      values: {
        total_debt: 200,
        equity: 100,
        total_assets: 500,
        total_liabilities: 350
      },
      fields: []
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({code:'ACCOUNTING_EQUATION_MISMATCH'})])
    );
  });
});
