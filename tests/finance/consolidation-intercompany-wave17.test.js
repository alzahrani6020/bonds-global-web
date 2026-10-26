const {
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

function baseEntity(id, role, ownershipPct = 100) {
  const isParent = role === 'parent';
  return {
    id,
    role,
    ...(role === 'subsidiary' ? { ownership_pct:ownershipPct } : {}),
    balance_rows:[
      { account_code:'1010', account_name:'Cash', account_type:'asset', debit:500, credit:0 },
      { account_code:'1100', account_name:'Intercompany AR', account_type:'asset', debit:isParent ? 100 : 0, credit:0 },
      { account_code:'2000', account_name:'Other Liability', account_type:'liability', debit:0, credit:isParent ? 200 : 100 },
      { account_code:'2100', account_name:'Intercompany AP', account_type:'liability', debit:0, credit:isParent ? 0 : 100 },
      { account_code:'3100', account_name:'Equity', account_type:'equity', debit:0, credit:300 },
      { account_code:'4100', account_name:'Revenue', account_type:'revenue', debit:0, credit:300 },
      { account_code:'6100', account_name:'Intercompany Revenue', account_type:'revenue', debit:0, credit:isParent ? 50 : 0 },
      { account_code:'5100', account_name:'Expense', account_type:'expense', debit:250, credit:0 },
      { account_code:'6200', account_name:'Intercompany Expense', account_type:'expense', debit:isParent ? 0 : 50, credit:0 }
    ],
    period_rows:[
      { account_code:'4100', account_name:'Revenue', account_type:'revenue', debit:0, credit:300 },
      { account_code:'6100', account_name:'Intercompany Revenue', account_type:'revenue', debit:0, credit:isParent ? 50 : 0 },
      { account_code:'5100', account_name:'Expense', account_type:'expense', debit:250, credit:0 },
      { account_code:'6200', account_name:'Intercompany Expense', account_type:'expense', debit:isParent ? 0 : 50, credit:0 },
      { account_code:'1010', account_name:'Cash', account_type:'asset', debit:isParent ? 100 : 0, credit:0 }
    ]
  };
}

describe('Consolidation and intercompany core wave 17', () => {
  test('consolidates full-owned entities and eliminates matched intercompany balances and income', () => {
    const parent=baseEntity('P','parent');
    const sub=baseEntity('S','subsidiary',100);

    const result=runFinancialEngine('consolidation',{
      entities:[parent,sub],
      match_tolerance:0.01,
      intercompany_pairs:[
        {
          id:'IC-BAL',
          type:'balance',
          source_amount:100,
          counterparty_amount:100,
          debit_account_code:'2100',
          credit_account_code:'1100'
        },
        {
          id:'IC-INC',
          type:'income',
          source_amount:50,
          counterparty_amount:50,
          debit_account_code:'6100',
          credit_account_code:'6200'
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.entity_count).toBe(2);
    expect(result.metrics.intercompany_pair_count).toBe(2);
    expect(result.metrics.elimination_total).toBe(150);
    expect(result.metrics.nci_equity_total).toBe(0);
    expect(result.metrics.intercompany_reconciliation.every(x=>x.matched)).toBe(true);
    expect(result.provenance.ai_generated).toBe(false);
  });

  test('fails closed when intercompany pair is outside matching tolerance', () => {
    const parent=baseEntity('P','parent');
    const sub=baseEntity('S','subsidiary',100);

    const result=runFinancialEngine('consolidation',{
      entities:[parent,sub],
      match_tolerance:1,
      intercompany_pairs:[{
        type:'balance',
        source_amount:100,
        counterparty_amount:90,
        debit_account_code:'2100',
        credit_account_code:'1100'
      }]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('intercompany_pairs[0].difference_within_tolerance');
  });

  test('requires explicit NCI values for partially owned subsidiaries', () => {
    const result=runFinancialEngine('consolidation',{
      entities:[
        baseEntity('P','parent'),
        baseEntity('S','subsidiary',80)
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('entities[1].nci.equity');
    expect(result.required_inputs).toContain('entities[1].nci.period_income');
  });

  test('accepts explicit NCI and acquisition adjustments without inventing purchase accounting', () => {
    const parent=baseEntity('P','parent');
    const sub=baseEntity('S','subsidiary',80);
    sub.nci={equity:60,period_income:20};

    const result=runFinancialEngine('consolidation',{
      entities:[parent,sub],
      adjustments:[]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.nci[0]).toEqual(expect.objectContaining({
      entity_id:'S',
      ownership_pct:80,
      nci_pct:20,
      nci_equity:60,
      nci_period_income:20
    }));
    expect(result.diagnostics.acquisition_accounting)
      .toBe('explicit_adjustments_only');
  });

  test('requires exactly one parent', () => {
    const result=runFinancialEngine('consolidation',{
      entities:[
        baseEntity('A','subsidiary',100),
        baseEntity('B','subsidiary',100)
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('exactly_one_parent');
  });
});
