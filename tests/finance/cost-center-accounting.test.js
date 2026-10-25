'use strict';

const fs=require('fs');
const path=require('path');
const {buildCostCenterAnalysis}=require('../../lib/finance/accounting/cost-center-analysis-engine');
const {SupabaseCostCenterLedgerStore}=require('../../lib/finance/accounting/supabase-cost-center-ledger-store');

const MIGRATION=fs.readFileSync(
  path.join(__dirname,'../../supabase/migrations/20261026020000_fixed_asset_depreciation_cost_centers.sql'),
  'utf8'
);

describe('accounting cost centers',()=>{
  test('aggregates revenue expenses and operating result by center',()=>{
    const result=buildCostCenterAnalysis([
      {cost_center_id:'cc1',cost_center_code:'OPS',cost_center_name:'Operations',account_code:'4100',account_name:'Revenue',account_type:'revenue',debit:0,credit:1000},
      {cost_center_id:'cc1',cost_center_code:'OPS',cost_center_name:'Operations',account_code:'5100',account_name:'Expense',account_type:'expense',debit:300,credit:0},
      {cost_center_id:'cc2',cost_center_code:'SALES',cost_center_name:'Sales',account_code:'4100',account_name:'Revenue',account_type:'revenue',debit:0,credit:500}
    ]);
    expect(result.totals).toMatchObject({
      revenue:1500,expenses:300,operating_result:1200,total_debit:300,total_credit:1500
    });
    expect(result.centers.find(x=>x.code==='OPS')).toMatchObject({
      revenue:1000,expenses:300,operating_result:700
    });
  });

  test('keeps unassigned movement visible',()=>{
    const result=buildCostCenterAnalysis([
      {cost_center_id:null,cost_center_code:'UNASSIGNED',cost_center_name:'Unassigned',account_code:'5100',account_name:'Expense',account_type:'expense',debit:200,credit:0},
      {cost_center_id:'cc1',cost_center_code:'OPS',cost_center_name:'Operations',account_code:'5100',account_name:'Expense',account_type:'expense',debit:800,credit:0}
    ]);
    expect(result.allocation.unassigned_movement).toBe(200);
    expect(result.allocation.unassigned_ratio).toBeCloseTo(0.2);
  });

  test('validates cost center before journal line persistence',()=>{
    expect(MIGRATION).toContain('add column if not exists cost_center_id uuid');
    expect(MIGRATION).toContain('accounting_resolve_line_cost_center');
    expect(MIGRATION).toContain("raise exception 'COST_CENTER_ID_INVALID'");
    expect(MIGRATION).toContain("raise exception 'COST_CENTER_NOT_ACTIVE'");
    expect(MIGRATION).toContain('idx_accounting_journal_lines_entity_cost_center');
  });

  test('cost center ledger is internal service-role only',()=>{
    expect(MIGRATION).toContain('create or replace function public.accounting_cost_center_ledger');
    expect(MIGRATION).toContain('from public, anon, authenticated');
    expect(MIGRATION).toContain('to service_role');
  });

  test('store queries governed cost center ledger',async()=>{
    const rpc=jest.fn(async()=>({data:[{cost_center_code:'OPS'}],error:null}));
    const store=new SupabaseCostCenterLedgerStore({rpc});
    const rows=await store.ledger({
      accountingEntityId:'entity-1',
      from:'2026-10-01',
      to:'2026-10-31'
    });
    expect(rpc).toHaveBeenCalledWith('accounting_cost_center_ledger',{
      p_accounting_entity_id:'entity-1',
      p_from:'2026-10-01',
      p_to:'2026-10-31'
    });
    expect(rows).toHaveLength(1);
  });

  test('invalid range fails before RPC',async()=>{
    const rpc=jest.fn();
    const store=new SupabaseCostCenterLedgerStore({rpc});
    await expect(store.ledger({
      accountingEntityId:'entity-1',
      from:'2026-11-01',
      to:'2026-10-01'
    })).rejects.toThrow('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
    expect(rpc).not.toHaveBeenCalled();
  });
});
