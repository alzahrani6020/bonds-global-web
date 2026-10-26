const {
  getRuntimeAdapter
} = require('../../lib/capabilities/runtime-adapters');

function governedInput() {
  return {
    entities: [
      {
        id: 'PARENT',
        role: 'parent',
        balance_rows: [
          { account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 50, credit: 0 },
          { account_code: '1200', account_name: 'Investment in Subsidiary', account_type: 'asset', debit: 50, credit: 0 },
          { account_code: '3100', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 100 }
        ],
        period_rows: [
          { account_code: '4100', account_name: 'Revenue', account_type: 'revenue', debit: 0, credit: 100 },
          { account_code: '5100', account_name: 'Expense', account_type: 'expense', debit: 100, credit: 0 }
        ]
      },
      {
        id: 'SUB',
        role: 'subsidiary',
        ownership_pct: 100,
        balance_rows: [
          { account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 50, credit: 0 },
          { account_code: '3100', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 50 }
        ],
        period_rows: [
          { account_code: '4100', account_name: 'Revenue', account_type: 'revenue', debit: 0, credit: 50 },
          { account_code: '5100', account_name: 'Expense', account_type: 'expense', debit: 50, credit: 0 }
        ]
      }
    ]
  };
}

describe('Governed consolidation runtime wave 17', () => {
  test('fails closed when a subsidiary has no explicit acquisition elimination', async () => {
    const adapter = getRuntimeAdapter('consolidation_engine');
    const result = await adapter({ inputs: governedInput() });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.error.code)
      .toBe('ACCOUNTING_ACQUISITION_ELIMINATION_REQUIRED');
    expect(result.required_inputs)
      .toContain('acquisition_elimination_required:SUB');
  });

  test('runs when the subsidiary acquisition elimination is explicit', async () => {
    const adapter = getRuntimeAdapter('consolidation_engine');
    const input = governedInput();
    input.adjustments = [{
      id: 'ACQ-SUB',
      scope: 'balance',
      adjustment_type: 'acquisition_elimination',
      subsidiary_entity_id: 'SUB',
      debit_account_code: '3100',
      credit_account_code: '1200',
      amount: 50
    }];

    const result = await adapter({ inputs: input });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.metrics.entity_count).toBe(2);
    expect(result.metrics.adjustment_total).toBe(50);
    expect(result.provenance.ai_generated).toBe(false);
  });
});
