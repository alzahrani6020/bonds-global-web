const {
  eliminationAccounts,
  SupabaseAccountingConsolidationStore
} = require('../../lib/finance/accounting/supabase-accounting-consolidation-store');

describe('Accounting consolidation store wave 17', () => {
  test('maps matched AR/AP links to a balanced elimination', () => {
    const pair=eliminationAccounts([
      {
        accounting_entity_id:'A',
        counterparty_accounting_entity_id:'B',
        account_code:'1100',
        account_name:'IC AR',
        account_type:'asset',
        debit:100,
        credit:0
      },
      {
        accounting_entity_id:'B',
        counterparty_accounting_entity_id:'A',
        account_code:'2100',
        account_name:'IC AP',
        account_type:'liability',
        debit:0,
        credit:100
      }
    ],'PAIR-1');

    expect(pair).toEqual(expect.objectContaining({
      type:'balance',
      debit_account_code:'2100',
      credit_account_code:'1100',
      source_amount:100,
      counterparty_amount:100
    }));
  });

  test('maps revenue/expense links to income elimination', () => {
    const pair=eliminationAccounts([
      {
        accounting_entity_id:'A',
        counterparty_accounting_entity_id:'B',
        account_code:'4100',
        account_name:'IC Revenue',
        account_type:'revenue',
        debit:0,
        credit:50
      },
      {
        accounting_entity_id:'B',
        counterparty_accounting_entity_id:'A',
        account_code:'5100',
        account_name:'IC Expense',
        account_type:'expense',
        debit:50,
        credit:0
      }
    ],'PAIR-2');

    expect(pair.type).toBe('income');
    expect(pair.debit_account_code).toBe('4100');
    expect(pair.credit_account_code).toBe('5100');
  });

  test('rejects incomplete or non-reciprocal pairs', () => {
    expect(()=>eliminationAccounts([{
      accounting_entity_id:'A',
      counterparty_accounting_entity_id:'B'
    }],'BAD')).toThrow('INTERCOMPANY_PAIR_INCOMPLETE:BAD');

    expect(()=>eliminationAccounts([
      {
        accounting_entity_id:'A',
        counterparty_accounting_entity_id:'B',
        account_type:'asset',
        account_code:'1100',
        debit:1
      },
      {
        accounting_entity_id:'C',
        counterparty_accounting_entity_id:'A',
        account_type:'liability',
        account_code:'2100',
        credit:1
      }
    ],'BAD2')).toThrow('INTERCOMPANY_PAIR_NOT_RECIPROCAL:BAD2');
  });

  test('fails closed when member currency differs from presentation currency', async () => {
    const supabase={
      rpc:jest.fn().mockResolvedValue({
        data:{
          group:{presentation_currency:'SAR'},
          members:[
            {entity_id:'A',role:'parent',ownership_pct:100,base_currency:'SAR'},
            {entity_id:'B',role:'subsidiary',ownership_pct:100,base_currency:'USD'}
          ],
          balance_rows:[],
          period_rows:[],
          intercompany_links:[]
        },
        error:null
      }),
      from:jest.fn()
    };

    const store=new SupabaseAccountingConsolidationStore(supabase);

    await expect(store.engineInput({
      groupId:'G1'
    })).rejects.toThrow('ACCOUNTING_CONSOLIDATION_FX_TRANSLATION_REQUIRED');
  });

  test('requires a Supabase-compatible database', () => {
    expect(()=>new SupabaseAccountingConsolidationStore(null))
      .toThrow('ACCOUNTING_CONSOLIDATION_DATABASE_REQUIRED');
  });
});
