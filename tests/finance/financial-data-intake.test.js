'use strict';

const {
  canonicalField,
  parseNumeric,
  requirementsFor,
  extractFinancialFields,
  validateDataset,
  classifyDocumentType,
  fieldConfidenceMap,
  qualityStatus,
  stableInputHash,
  buildDependencyGraph
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
  test('keeps multiple periods explicit instead of silently choosing one', () => {
    const extracted = extractFinancialFields({
      primaryAction: 'financial_analysis_run',
      serviceCode: 'debt_to_equity_analysis',
      parsed: {
        rows: [
          ['Total debt','200000','SAR','2025'],
          ['Total debt','250000','SAR','2026'],
          ['Equity','100000','SAR','2026']
        ],
        text: ''
      }
    });
    const debt = extracted.fields.find(x => x.field === 'total_debt');
    expect(debt.status).toBe('multi_period');
    expect(debt.period_values).toMatchObject({ '2025': 200000, '2026': 250000 });
    expect(extracted.validation.valid).toBe(false);
    expect(extracted.validation.quality_gate).toBe('FAIL_CLOSED');
  });

  test('classifies known document types conservatively and leaves unknown unknown', () => {
    expect(classifyDocumentType({ text: 'Statement of financial position for 2026' })).toBe('balance_sheet');
    expect(classifyDocumentType({ text: 'كشف الحساب البنكي للفترة' })).toBe('bank_statement');
    expect(classifyDocumentType({ text: 'unstructured notes without a financial statement heading' })).toBe('unknown');
  });

  test('produces confidence, quality, stable hash and dependency evidence', () => {
    const fields = [
      { field:'total_debt', value:200000, status:'extracted', confidence:0.95, source:[{extraction_method:'tabular_parser'}] },
      { field:'equity', value:100000, status:'manual', source:[{extraction_method:'manual_input'}] }
    ];
    const confidence = fieldConfidenceMap(fields);
    expect(confidence).toEqual({ total_debt:0.95, equity:1 });
    expect(qualityStatus({ validation:{valid:true,missing:[]}, fields, reviewed:true })).toBe('verified');
    expect(stableInputHash({equity:100000,total_debt:200000}))
      .toBe(stableInputHash({total_debt:200000,equity:100000}));
    expect(buildDependencyGraph({
      requirementFields:['total_debt','equity'],
      serviceCode:'debt_to_equity_analysis',
      engineCode:'financial_analysis'
    }).edges).toEqual(expect.arrayContaining([
      expect.objectContaining({from:'input:total_debt',to:'engine:financial_analysis'})
    ]));
  });

  test('maps liquidity requirements to structured periods and opening balance', () => {
    const required = requirementsFor({
      primaryAction: 'cash_flow_analysis_run',
      serviceCode: 'liquidity_gap_analysis',
      values: {}
    });
    expect(required.requirement_fields).toEqual(
      expect.arrayContaining(['periods','opening_balance'])
    );
  });

  test('quality status ignores unused alternative fields after validation passes', () => {
    const fields = [
      { field:'total_debt', value:200000, status:'extracted', confidence:0.95, source:[] },
      { field:'equity', value:100000, status:'extracted', confidence:0.95, source:[] },
      { field:'total_assets', value:null, status:'missing', candidates:[], source:[] },
      { field:'total_liabilities', value:null, status:'missing', candidates:[], source:[] }
    ];
    expect(qualityStatus({
      validation:{ valid:true, missing:[], unresolved:[] },
      fields,
      reviewed:true
    })).toBe('verified');
  });

  test('does not fail on unused alternative fields once the engine has enough data', () => {
    const fields = [
      { field:'total_debt', value:200000, status:'extracted', confidence:0.95, currency:'SAR', period:'2026', source:[] },
      { field:'equity', value:100000, status:'extracted', confidence:0.95, currency:'SAR', period:'2026', source:[] },
      { field:'total_assets', value:null, status:'missing', candidates:[], currency:null, period:null, source:[] },
      { field:'total_liabilities', value:null, status:'missing', candidates:[], currency:null, period:null, source:[] }
    ];
    const validation = validateDataset({
      primaryAction:'financial_analysis_run',
      serviceCode:'debt_to_equity_analysis',
      values:{ total_debt:200000, equity:100000 },
      fields
    });
    expect(validation.valid).toBe(true);
    expect(validation.unresolved).toEqual([]);
    expect(validation.missing).toEqual([]);
    expect(validation.quality_gate).toBe('PASS');
  });


  test('supports tax health check intake without enabling a tax execution engine', () => {
    const required = requirementsFor({
      primaryAction: null,
      serviceCode: 'tax_health_check',
      values: {}
    });
    expect(required.supported).toBe(true);
    expect(required.engine_code).toBeNull();
    expect(required.intake_profile).toBe('tax_zakat');
    expect(required.requirement_fields).toEqual(
      expect.arrayContaining(['revenue','total_assets','total_liabilities','equity','output_vat','input_vat'])
    );
    expect(required.required_inputs).toEqual(
      expect.arrayContaining(['revenue','total_assets','total_liabilities','equity'])
    );
  });

  test('extracts VAT intake fields conservatively with provenance', () => {
    const extracted = extractFinancialFields({
      primaryAction: null,
      serviceCode: 'vat_return_preparation',
      parsed: {
        sheet_name: 'VAT',
        rows: [
          ['Taxable sales','100000','SAR','2026'],
          ['Output VAT','15000','SAR','2026'],
          ['Taxable purchases','40000','SAR','2026'],
          ['Input VAT','6000','SAR','2026']
        ],
        text: ''
      }
    });
    expect(extracted.values).toMatchObject({
      taxable_sales:100000,
      output_vat:15000,
      taxable_purchases:40000,
      input_vat:6000
    });
    expect(extracted.validation.valid).toBe(true);
    expect(extracted.engine_code).toBeNull();
    expect(extracted.provenance.output_vat[0]).toMatchObject({
      extraction_method:'tabular_parser',
      sheet:'VAT',
      row:2,
      column:2
    });
  });

  test('fails closed when required VAT fields are missing', () => {
    const extracted = extractFinancialFields({
      primaryAction: null,
      serviceCode: 'vat_return_preparation',
      parsed: {
        rows: [['Output VAT','15000']],
        text: ''
      }
    });
    expect(extracted.validation.valid).toBe(false);
    expect(extracted.validation.quality_gate).toBe('FAIL_CLOSED');
    expect(extracted.validation.missing).toContain('input_vat');
    expect(extracted.fields.find(x => x.field === 'input_vat').status).toBe('missing');
  });

  test('classifies zakat, VAT and tax invoice documents', () => {
    expect(classifyDocumentType({ text:'الإقرار الزكوي للسنة المالية 2026' })).toBe('zakat_return');
    expect(classifyDocumentType({ text:'إقرار ضريبة القيمة المضافة للربع الرابع' })).toBe('vat_return');
    expect(classifyDocumentType({ text:'فاتورة ضريبية - ضريبة القيمة المضافة' })).toBe('tax_invoice');
  });

  test('builds direct intake dependency evidence when no execution engine exists', () => {
    const graph = buildDependencyGraph({
      requirementFields:['revenue','total_assets'],
      serviceCode:'tax_health_check',
      engineCode:null
    });
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({from:'input:revenue',to:'service:tax_health_check',type:'required_input'}),
      expect.objectContaining({from:'input:total_assets',to:'service:tax_health_check',type:'required_input'})
    ]));
  });

});
