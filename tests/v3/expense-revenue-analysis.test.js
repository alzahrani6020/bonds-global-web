'use strict';

const fs=require('fs');
const path=require('path');
const { runFinancialEngine }=require('../../lib/finance/financial-engine-registry');
const { requirementsFor, canonicalField }=require('../../lib/finance/financial-data-intake');

describe('expense revenue analysis service',()=>{
  const migration=fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261027006700_activate_expense_revenue_analysis.sql'),
    'utf8'
  );

  test('computes expense-to-revenue and surplus deterministically',()=>{
    const result=runFinancialEngine('financial_analysis',{
      revenue:1000,
      total_expenses:750
    },{serviceCode:'expense_revenue_analysis'});

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.metrics.total_expenses).toBe(750);
    expect(result.metrics.revenue_expense_surplus).toBe(250);
    expect(result.metrics.expense_to_revenue_pct).toBe(75);
    expect(result.metrics.revenue_expense_surplus_margin_pct).toBe(25);
  });

  test('fails closed on missing or invalid explicit inputs',()=>{
    const missing=runFinancialEngine('financial_analysis',{
      revenue:1000
    },{serviceCode:'expense_revenue_analysis'});
    expect(missing.ok).toBe(false);
    expect(missing.required_inputs).toContain('total_expenses');

    const negative=runFinancialEngine('financial_analysis',{
      revenue:1000,
      total_expenses:-1
    },{serviceCode:'expense_revenue_analysis'});
    expect(negative.ok).toBe(false);
    expect(negative.required_inputs).toContain('non_negative_total_expenses');

    const zeroRevenue=runFinancialEngine('financial_analysis',{
      revenue:0,
      total_expenses:100
    },{serviceCode:'expense_revenue_analysis'});
    expect(zeroRevenue.ok).toBe(false);
    expect(zeroRevenue.required_inputs).toContain('non_zero_revenue');
  });

  test('financial intake exposes only the active scoped requirements',()=>{
    const req=requirementsFor({
      primaryAction:'financial_analysis_run',
      serviceCode:'expense_revenue_analysis',
      values:{}
    });
    expect(req.supported).toBe(true);
    expect(req.required_inputs).toEqual(expect.arrayContaining(['revenue','total_expenses']));
    expect(req.requirement_fields).toEqual(expect.arrayContaining(['revenue','total_expenses']));
    expect(canonicalField('إجمالي المصروفات')).toBe('total_expenses');
    expect(canonicalField('total expenses')).toBe('total_expenses');
  });

  test('migration activates exactly one verified service through the existing engine',()=>{
    expect(migration).toContain('if candidate_count <> 1 then');
    expect(migration).toContain('if mapped_count <> 0 then');
    expect(migration).toContain("'financial_analysis_run'");
    expect(migration).toContain("execution_mode='capability_plan'");
    expect(migration).toContain("execution_status='partially_automated'");
    expect(migration).not.toContain("'orchestrator_run'");
    expect(migration).not.toContain("'native_generate'");
  });
});
