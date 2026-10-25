'use strict';

const {
  FinancialStatementMappingRegistry,
  createDefaultFinancialStatementMapping
} = require('../../lib/finance/accounting/financial-statement-mapping');
const {
  trialBalance,
  buildFinancialStatements
} = require('../../lib/finance/accounting/ledger-report-engine');
const {
  runFinancialEngineFromLedger
} = require('../../lib/finance/financial-engine-registry');
const {
  SupabaseLedgerReportingStore
} = require('../../lib/finance/accounting/supabase-ledger-reporting-store');

function sampleRows() {
  return {
    balanceRows: [
      { account_code:'1010', account_name:'Cash and Bank', account_type:'asset', debit:1400, credit:0 },
      { account_code:'2200', account_name:'Bank Debt', account_type:'liability', debit:0, credit:200 },
      { account_code:'3000', account_name:'Capital', account_type:'equity', debit:0, credit:1000 },
      { account_code:'4100', account_name:'Service Revenue', account_type:'revenue', debit:0, credit:500 },
      { account_code:'5100', account_name:'Operating Expenses', account_type:'expense', debit:300, credit:0 }
    ],
    periodRows: [
      { account_code:'1010', account_name:'Cash and Bank', account_type:'asset', debit:200, credit:0 },
      { account_code:'4100', account_name:'Service Revenue', account_type:'revenue', debit:0, credit:500 },
      { account_code:'5100', account_name:'Operating Expenses', account_type:'expense', debit:300, credit:0 }
    ]
  };
}

describe('ledger reporting and analysis bridge', () => {
  test('builds balanced deterministic statements from ledger rows', () => {
    const { balanceRows, periodRows } = sampleRows();
    const statements = buildFinancialStatements({ balanceRows, periodRows });

    expect(statements.ok).toBe(true);
    expect(statements.trial_balance.cumulative).toMatchObject({
      ok:true,
      total_debit:1700,
      total_credit:1700,
      difference:0
    });
    expect(statements.balance_sheet).toMatchObject({
      total_assets:1400,
      total_liabilities:200,
      base_equity:1000,
      cumulative_earnings:200,
      total_equity:1200,
      accounting_difference:0
    });
    expect(statements.income_statement).toEqual({
      revenue:500,
      expenses:300,
      net_income:200
    });
    expect(statements.normalized_input).toMatchObject({
      total_assets:1400,
      total_liabilities:200,
      equity:1200,
      revenue:500,
      net_income:200,
      cash:1400,
      operating_expenses:300
    });
    expect(statements.normalized_input.current_assets).toBeUndefined();
    expect(statements.normalized_input.total_debt).toBeUndefined();
  });

  test('fails closed on unbalanced ledger data', () => {
    expect(() => buildFinancialStatements({
      balanceRows:[
        {account_code:'1010',account_name:'Cash',account_type:'asset',debit:100,credit:0}
      ],
      periodRows:[]
    })).toThrow('CUMULATIVE_TRIAL_BALANCE_UNBALANCED');
  });

  test('contra accounts reduce their natural statement group', () => {
    const trial = trialBalance([
      {account_code:'1200',account_name:'Equipment',account_type:'asset',debit:1000,credit:0},
      {account_code:'1290',account_name:'Accumulated Depreciation',account_type:'contra_asset',debit:0,credit:200},
      {account_code:'3000',account_name:'Capital',account_type:'equity',debit:0,credit:800}
    ]);
    expect(trial.ok).toBe(true);

    const statements = buildFinancialStatements({
      balanceRows:trial.rows,
      periodRows:[]
    });
    expect(statements.balance_sheet.total_assets).toBe(800);
    expect(statements.balance_sheet.total_equity).toBe(800);
  });

  test('explicit mapping can add debt and current classifications without guessing', () => {
    const mapping = createDefaultFinancialStatementMapping([
      {
        account_code:'1010',
        targets:[
          {field:'cash'},
          {field:'current_assets'}
        ]
      },
      {
        account_code:'2200',
        targets:[
          {field:'total_debt'},
          {field:'current_liabilities'}
        ]
      }
    ]);
    const { balanceRows, periodRows } = sampleRows();
    const statements = buildFinancialStatements({
      balanceRows,
      periodRows,
      mappingRegistry:mapping
    });

    expect(statements.normalized_input).toMatchObject({
      cash:1400,
      current_assets:1400,
      total_debt:200,
      current_liabilities:200
    });
  });

  test('mapping registry rejects unsupported canonical fields', () => {
    expect(() => new FinancialStatementMappingRegistry([{
      account_code:'9999',
      targets:[{field:'invented_metric'}]
    }])).toThrow('STATEMENT_MAPPING_FIELD_UNSUPPORTED');
  });

  test('feeds verified ledger statements into the existing financial engine', () => {
    const mapping = createDefaultFinancialStatementMapping([
      {
        account_code:'2200',
        targets:[{field:'total_debt'}]
      }
    ]);
    const { balanceRows, periodRows } = sampleRows();
    const result = runFinancialEngineFromLedger({
      engineCode:'financial_analysis',
      balanceRows,
      periodRows,
      mappingRegistry:mapping,
      options:{serviceCode:'debt_to_equity_analysis'}
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.metrics.debt_to_equity).toBeCloseTo(200 / 1200);
    expect(result.diagnostics).toMatchObject({
      input_source:'accounting_ledger',
      trial_balance_verified:true,
      balance_sheet_equation_verified:true
    });
    expect(result.provenance.ai_generated).toBe(false);
    expect(result.accounting_statements.balance_sheet.accounting_difference).toBe(0);
  });

  test('Supabase reporting store obtains cumulative and period rows through governed RPC', async () => {
    const rpc = jest.fn(async (_name, args) => ({
      data:[{
        account_code:args.p_from ? '4100' : '1010',
        account_name:args.p_from ? 'Revenue' : 'Cash',
        account_type:args.p_from ? 'revenue' : 'asset',
        debit:0,
        credit:0
      }],
      error:null
    }));
    const store = new SupabaseLedgerReportingStore({rpc});
    const data = await store.statementRows({
      accountingEntityId:'11111111-1111-4111-8111-111111111111',
      startsOn:'2026-10-01',
      endsOn:'2026-10-31'
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1,'accounting_ledger_balances',{
      p_accounting_entity_id:'11111111-1111-4111-8111-111111111111',
      p_from:null,
      p_to:'2026-10-31'
    });
    expect(rpc).toHaveBeenNthCalledWith(2,'accounting_ledger_balances',{
      p_accounting_entity_id:'11111111-1111-4111-8111-111111111111',
      p_from:'2026-10-01',
      p_to:'2026-10-31'
    });
    expect(data.balanceRows).toHaveLength(1);
    expect(data.periodRows).toHaveLength(1);
  });

  test('reporting store rejects invalid date ranges before database execution', async () => {
    const rpc = jest.fn();
    const store = new SupabaseLedgerReportingStore({rpc});
    await expect(store.statementRows({
      accountingEntityId:'entity-1',
      startsOn:'2026-11-01',
      endsOn:'2026-10-01'
    })).rejects.toThrow('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
    expect(rpc).not.toHaveBeenCalled();
  });
});
