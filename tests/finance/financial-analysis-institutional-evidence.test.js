'use strict';
const fs=require('fs'),path=require('path');
const {financialAnalysis}=require('../../lib/finance/engines/financial-analysis-engine');
const {deriveFinancialInputs,validateDataset,requirementsFor,qualityStatus,financialStatementCoverage}=require('../../lib/finance/financial-data-intake');
const {render}=require('../../components/financial-analysis-report');
const values={
 revenue:2000000,cogs:1200000,operating_expenses:400000,
 net_income:250000,depreciation_amortization:50000,
 total_assets:1200000,total_liabilities:600000,
 current_assets:400000,current_liabilities:220000,
 inventory:100000,receivables:150000,payables:120000,cash:200000,
 total_debt:300000,interest_expense:50000,
 opening_balance:180000,operating_cash_flow:250000,
 investing_cash_flow:-200000,financing_cash_flow:-30000,
 cash_flow_net_income:250000,
 cash_available_for_debt_service:300000,scheduled_debt_service:150000,
 one_off_income:30000,prior_revenue:1800000
};
const evaluate=x=>validateDataset({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis',
 values:x.values,fields:x.fields});
describe('governed financial analysis: cash flow, D&A and evidence gate',()=>{
 test('derives EBIT, EBITDA and closing cash only from supported accounting evidence',()=>{
  const r=deriveFinancialInputs(values);
  expect(r.values.operating_income).toBe(400000);
  expect(r.values.ebitda).toBe(450000);
  expect(r.values.ending_cash).toBe(200000);
  expect(evaluate(r).valid).toBe(true);
  expect(r.derived.map(x=>x.field)).toEqual(expect.arrayContaining([
   'operating_income','ebitda','ending_cash'
  ]));
 });
 test('engine reports real cash-flow quality and credit ratios without external estimates',()=>{
  const r=financialAnalysis(deriveFinancialInputs(values).values,{serviceCode:'financial_analysis'});
  expect(r.executed).toBe(true);
  expect(r.metrics.ebitda).toBe(450000);
  expect(r.metrics.interest_coverage).toBe(8);
  expect(r.metrics.ebitda_interest_coverage).toBe(9);
  expect(r.metrics.dscr).toBe(2);
  expect(r.metrics.net_cash_flow).toBe(20000);
  expect(r.metrics.ending_cash_from_flow).toBe(200000);
  expect(r.metrics.operating_cash_to_net_income).toBe(1);
  expect(r.metrics.adjusted_net_income_excluding_one_off).toBe(220000);
  expect(r.metrics.cash_conversion_cycle_days).toBeCloseTo(21.2916667,4);
  expect(r.metrics.revenue_growth_pct).toBeCloseTo(11.111111,4);
 });
 test('absence of D&A never creates invented EBITDA for financial analysis',()=>{
  const input={...values};
  delete input.depreciation_amortization;
  const derived=deriveFinancialInputs(input);
  expect(derived.values.ebitda).toBeUndefined();
  expect(financialAnalysis(derived.values,{serviceCode:'financial_analysis'}).metrics.ebitda).toBeNull();
  const noCFADS={...values};
  delete noCFADS.cash_available_for_debt_service;
  expect(financialAnalysis(noCFADS,{serviceCode:'financial_analysis'}).metrics.dscr).toBeNull();
 });
 test('mismatched cash-flow components or EBITDA are blocked before verified status',()=>{
  const broken={...values,ending_cash:240000,ebitda:600000,cash_flow_net_income:280000};
  const derived=deriveFinancialInputs(broken);
  const result=evaluate(derived);
  expect(result.valid).toBe(false);
  expect(result.errors.map(x=>x.code)).toEqual(expect.arrayContaining([
   'CASH_FLOW_RECONCILIATION_MISMATCH',
   'CROSS_STATEMENT_CASH_MISMATCH',
   'CROSS_STATEMENT_NET_INCOME_MISMATCH',
   'EBITDA_RECONCILIATION_MISMATCH'
  ]));
 });
 test('verified status requires all three financial statements, not just three ratio inputs',()=>{
  const partial={revenue:2000000,current_assets:400000,current_liabilities:200000};
  const valid=validateDataset({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis',values:partial,fields:[]});
  expect(valid.valid).toBe(true);
  expect(qualityStatus({validation:valid,fields:[],reviewed:true,serviceCode:'financial_analysis',values:partial})).toBe('partial');
  expect(financialStatementCoverage(partial).overall_complete).toBe(false);
  const full=deriveFinancialInputs(values);
  expect(financialStatementCoverage(full.values).overall_complete).toBe(true);
  expect(qualityStatus({validation:evaluate(full),fields:full.fields,reviewed:true,
   serviceCode:'financial_analysis',values:full.values})).toBe('verified');
 });
 test('financial intake and manual panel expose all real statement inputs',()=>{
  const fields=requirementsFor({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'})
   .requirement_fields;
  for(const key of ['depreciation_amortization','operating_cash_flow','investing_cash_flow',
   'financing_cash_flow','opening_balance','ending_cash','scheduled_debt_service',
   'cash_available_for_debt_service','payables','one_off_income','cash_flow_net_income']){
   expect(fields).toContain(key);
  }
  const client=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
  expect(client).toContain("['depreciation_amortization'");
  expect(client).toContain("['cash_available_for_debt_service'");
 });
 test('PDF makes limitations explicit and shows real cash-flow, credit and source inputs',()=>{
  const input=deriveFinancialInputs(values).values;
  const engine=financialAnalysis(input,{serviceCode:'financial_analysis'});
  const html=render({
   executed:true,result:{engineResults:{financial_analysis:engine}},
   dataset:{inputs_used:input,source:{file_name:'Statements 2026.xlsx'},dataset_id:'readback-test'},
   dataset_persistence:{status:'saved',verified:true}
  },'ar');
  expect(html).toContain('تحليل التدفقات النقدية');
  expect(html).toContain('جودة الأرباح');
  expect(html).toContain('الملاءة وخدمة الدين ورأس المال العامل');
  expect(html).toContain('مطابقة القوائم');
  expect(html).toContain('2</td>');
  expect(html).toContain('لا المتوسطات');
  expect(html).toContain('غير مطبقة');
  expect(html).toContain('Statements 2026.xlsx');
 });
});
