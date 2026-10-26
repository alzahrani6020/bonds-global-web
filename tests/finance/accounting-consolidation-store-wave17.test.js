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
          balance_rows:[
            {
              entity_id:'B',
              account_code:'1010',
              account_name:'Cash',
              account_type:'asset',
              debit:100,
              credit:0
            }
          ],
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

  test('translates foreign entity rows and intercompany links into presentation currency', async () => {
    const supabase={
      rpc:jest.fn().mockResolvedValue({
        data:{
          group:{presentation_currency:'SAR'},
          members:[
            {entity_id:'A',role:'parent',ownership_pct:100,base_currency:'SAR'},
            {entity_id:'B',role:'subsidiary',ownership_pct:100,base_currency:'USD'}
          ],
          balance_rows:[
            {
              entity_id:'A',
              account_code:'1100',
              account_name:'IC AR',
              account_type:'asset',
              debit:375,
              credit:0
            },
            {
              entity_id:'A',
              account_code:'3100',
              account_name:'Parent Equity',
              account_type:'equity',
              debit:0,
              credit:375
            },
            {
              entity_id:'B',
              account_code:'1010',
              account_name:'Cash',
              account_type:'asset',
              debit:100,
              credit:0
            },
            {
              entity_id:'B',
              account_code:'2100',
              account_name:'IC AP',
              account_type:'liability',
              debit:0,
              credit:100
            }
          ],
          period_rows:[
            {
              entity_id:'B',
              account_code:'4100',
              account_name:'Revenue',
              account_type:'revenue',
              debit:0,
              credit:50
            },
            {
              entity_id:'B',
              account_code:'5100',
              account_name:'Expense',
              account_type:'expense',
              debit:50,
              credit:0
            }
          ],
          intercompany_links:[
            {
              pair_key:'PAIR-FX',
              accounting_entity_id:'A',
              counterparty_accounting_entity_id:'B',
              account_code:'1100',
              account_name:'IC AR',
              account_type:'asset',
              debit:375,
              credit:0
            },
            {
              pair_key:'PAIR-FX',
              accounting_entity_id:'B',
              counterparty_accounting_entity_id:'A',
              account_code:'2100',
              account_name:'IC AP',
              account_type:'liability',
              debit:0,
              credit:100
            }
          ]
        },
        error:null
      }),
      from:jest.fn()
    };

    const store=new SupabaseAccountingConsolidationStore(supabase);
    const prepared=await store.engineInput({
      groupId:'G1',
      fxTranslations:{
        B:{
          rates:{
            closing:{rate:3.75,source:'governed_test'},
            average:{rate:4.10,appropriate:true,source:'governed_test'}
          }
        }
      }
    });

    const foreign=prepared.engine_input.entities.find(entity=>entity.id==='B');
    expect(foreign.balance_rows.find(row=>row.account_code==='1010').debit).toBe(375);
    expect(foreign.balance_rows.find(row=>row.account_code==='2100').credit).toBe(375);
    expect(foreign.period_rows.find(row=>row.account_code==='4100').credit).toBe(205);
    expect(foreign.period_rows.find(row=>row.account_code==='5100').debit).toBe(205);

    expect(prepared.engine_input.intercompany_pairs[0]).toEqual(
      expect.objectContaining({
        id:'PAIR-FX',
        source_amount:375,
        counterparty_amount:375
      })
    );

    expect(prepared.fx_translation_evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_id:'B',
          functional_currency:'USD',
          presentation_currency:'SAR',
          deterministic:true,
          ai_generated:false
        })
      ])
    );
  });

  test('requires a Supabase-compatible database', () => {
    expect(()=>new SupabaseAccountingConsolidationStore(null))
      .toThrow('ACCOUNTING_CONSOLIDATION_DATABASE_REQUIRED');
  });
});
