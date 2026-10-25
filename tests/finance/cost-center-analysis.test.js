'use strict';

const {
  buildCostCenterAnalysis
} = require('../../lib/finance/accounting/cost-center-analysis-engine');
const {
  SupabaseCostCenterLedgerStore
} = require('../../lib/finance/accounting/supabase-cost-center-ledger-store');

describe('cost center analysis', () => {
  test('aggregates revenue, expenses and operating result by cost center', () => {
    const result = buildCostCenterAnalysis([
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'4100',
        account_name:'Revenue',
        account_type:'revenue',
        debit:0,
        credit:1000
      },
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'5100',
        account_name:'Expense',
        account_type:'expense',
        debit:300,
        credit:0
      },
      {
        cost_center_id:'cc-2',
        cost_center_code:'SALES',
        cost_center_name:'Sales',
        account_code:'4100',
        account_name:'Revenue',
        account_type:'revenue',
        debit:0,
        credit:500
      }
    ]);

    expect(result.ok).toBe(true);
    expect(result.centers).toEqual([
      expect.objectContaining({
        code:'OPS',
        revenue:1000,
        expenses:300,
        operating_result:700,
        total_debit:300,
        total_credit:1000
      }),
      expect.objectContaining({
        code:'SALES',
        revenue:500,
        expenses:0,
        operating_result:500,
        total_debit:0,
        total_credit:500
      })
    ]);
    expect(result.totals).toMatchObject({
      revenue:1500,
      expenses:300,
      operating_result:1200,
      total_debit:300,
      total_credit:1500
    });
  });

  test('surfaces unassigned movement instead of silently dropping it', () => {
    const result = buildCostCenterAnalysis([
      {
        cost_center_id:null,
        cost_center_code:'UNASSIGNED',
        cost_center_name:'Unassigned',
        account_code:'5100',
        account_name:'Expense',
        account_type:'expense',
        debit:200,
        credit:0
      },
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'5100',
        account_name:'Expense',
        account_type:'expense',
        debit:800,
        credit:0
      }
    ]);

    expect(result.allocation.unassigned_movement).toBe(200);
    expect(result.allocation.unassigned_ratio).toBeCloseTo(0.2);
  });

  test('contra revenue and contra expense reduce their natural groups', () => {
    const result = buildCostCenterAnalysis([
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'4100',
        account_name:'Revenue',
        account_type:'revenue',
        debit:0,
        credit:1000
      },
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'4190',
        account_name:'Sales Returns',
        account_type:'contra_revenue',
        debit:100,
        credit:0
      },
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'5100',
        account_name:'Expense',
        account_type:'expense',
        debit:400,
        credit:0
      },
      {
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'5190',
        account_name:'Expense Reversal',
        account_type:'contra_expense',
        debit:0,
        credit:50
      }
    ]);

    expect(result.centers[0]).toMatchObject({
      revenue:900,
      expenses:350,
      operating_result:550
    });
  });

  test('store queries governed cost center ledger RPC', async () => {
    const rpc = jest.fn(async () => ({
      data:[{
        cost_center_id:'cc-1',
        cost_center_code:'OPS',
        cost_center_name:'Operations',
        account_code:'5100',
        account_name:'Expense',
        account_type:'expense',
        debit:100,
        credit:0
      }],
      error:null
    }));

    const store = new SupabaseCostCenterLedgerStore({rpc});
    const rows = await store.ledger({
      accountingEntityId:'entity-1',
      from:'2026-10-01',
      to:'2026-10-31'
    });

    expect(rpc).toHaveBeenCalledWith('accounting_cost_center_ledger', {
      p_accounting_entity_id:'entity-1',
      p_from:'2026-10-01',
      p_to:'2026-10-31'
    });
    expect(rows).toHaveLength(1);
  });

  test('invalid reporting range is rejected before RPC', async () => {
    const rpc = jest.fn();
    const store = new SupabaseCostCenterLedgerStore({rpc});

    await expect(store.ledger({
      accountingEntityId:'entity-1',
      from:'2026-11-01',
      to:'2026-10-01'
    })).rejects.toThrow('ACCOUNTING_REPORT_DATE_RANGE_INVALID');

    expect(rpc).not.toHaveBeenCalled();
  });
});
