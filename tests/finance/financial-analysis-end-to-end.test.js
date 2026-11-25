'use strict';

const { financialAnalysis } = require('../../lib/finance/engines/financial-analysis-engine');
const { extractFinancialFields, validateDataset, requirementsFor } = require('../../lib/finance/financial-data-intake');
const { render } = require('../../components/financial-analysis-report');

describe('BONDS governed financial analysis end-to-end boundaries',()=>{
 const base={
  revenue:1000000,cogs:600000,operating_expenses:200000,
  operating_income:200000,ebitda:270000,net_income:120000,
  current_assets:300000,current_liabilities:150000,
  total_assets:900000,total_liabilities:500000,equity:400000,
  total_debt:250000,interest_expense:50000,cash:80000
 };
 test('conventional EBIT coverage is not mislabeled EBITDA coverage',()=>{
  const r=financialAnalysis(base,{serviceCode:'financial_analysis'});
  expect(r.executed).toBe(true);
  expect(r.metrics.interest_coverage).toBeCloseTo(4,10);
  expect(r.metrics.ebitda_interest_coverage).toBeCloseTo(5.4,10);
  expect(r.metrics.debt_to_equity).toBeCloseTo(.625,10);
  expect(r.metrics.liabilities_to_equity).toBeCloseTo(1.25,10);
 });
 test('quick liquidity requires observed inventory; no zero-inventory assumption',()=>{
  const r=financialAnalysis(base,{serviceCode:'financial_analysis'});
  expect(r.metrics.current_ratio).toBeCloseTo(2,10);
  expect(r.metrics.quick_ratio).toBeNull();
  expect(financialAnalysis({...base,inventory:45000},{serviceCode:'financial_analysis'}).metrics.quick_ratio).toBeCloseTo(1.7,10);
 });
 test('comprehensive intake extracts recognized optional statement fields with row sources',()=>{
  const parsed={
   sheet_name:'Statement',
   rows:[
    ['Revenue','1000000'],['Current Assets','300000'],['Current Liabilities','150000'],
    ['Net Income','120000'],['Total Liabilities','500000'],
    ['Cost of Goods Sold','600000'],['Inventory','45000'],
    ['Interest Expense','50000']
   ]
  };
  const x=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values).toMatchObject({revenue:1000000,current_assets:300000,
   current_liabilities:150000,net_income:120000,total_liabilities:500000,
   cogs:600000,inventory:45000,interest_expense:50000});
  expect(x.validation.valid).toBe(true);
  expect(x.fields.find(f=>f.field==='inventory').source[0]).toMatchObject({row:7,column:2});
  const required=requirementsFor({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(required.requirement_fields).toContain('net_income');
  expect(required.requirement_fields).toContain('inventory');
  expect(required.requirement_fields).not.toContain('zakat_base');
 });
 test('year preceding a value must not replace the amount',()=>{
  const x=extractFinancialFields({parsed:{text:'Revenue 2026 1000000\nCurrent Assets 300000\nCurrent Liabilities 150000'},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values.revenue).toBe(1000000);
  const ambiguous=extractFinancialFields({parsed:{text:'Revenue 2026 1000000 2025 900000\nCurrent Assets 300000\nCurrent Liabilities 150000'},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(ambiguous.values.revenue).toBeUndefined();
  expect(ambiguous.validation.valid).toBe(false);
 });
 test('traditional interest coverage requires EBIT, not only EBITDA',()=>{
  const report=financialAnalysis({ebitda:250000,interest_expense:50000},{serviceCode:'interest_coverage_analysis'});
  expect(report.executed).toBe(false);
  expect(report.required_inputs).toContain('operating_income');
 });
 test('missing core inputs remain fail closed',()=>{
  const validation=validateDataset({primaryAction:'financial_analysis_run',
    serviceCode:'financial_analysis',values:{net_income:120000},fields:[]});
  expect(validation.valid).toBe(false);
  expect(validation.missing).toEqual(expect.arrayContaining(['revenue','current_assets','current_liabilities']));
 });
 test('report contains only real execution metrics, escaped Arabic input and evidence status',()=>{
  const calculated=financialAnalysis(base,{serviceCode:'financial_analysis'});
  const p={executed:true,result:{engineResults:{financial_analysis:calculated}},dataset:{
   dataset_id:'test-1',dataset_version:1,input_hash:'hash',
   inputs_used:{revenue:1000000,project_name:'<svg onload=alert(1)>'},
   source:{file_name:'القوائم المالية 2026.xlsx',file_version:'sha256:abc'},
   field_provenance:[{field:'revenue',value:1000000,status:'extracted',source:[{sheet:'2026',row:3,column:2}]}]
  },dataset_persistence:{status:'saved',verified:true,dataset_id:'test-1'}};
  const html=render(p,'ar');
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('القوائم المالية 2026.xlsx');
  expect(html).toContain('التحليل المالي');
  expect(html).toContain('4</td>');
  expect(html).toContain('&lt;svg onload=alert(1)&gt;');
  expect(html).not.toContain('<svg onload=alert(1)>');
  expect(html).toContain('تم التحقق من حفظ النتائج');
  const english=render(p,'en');
  expect(english).toContain('Financial Analysis Report');
  p.dataset_persistence={status:'unverified'};
  expect(render(p,'ar')).toContain('الحفظ غير مؤكد');
  expect(()=>render({executed:false,result:{metrics:{revenue:100}}})).toThrow(/REQUIRES_EXECUTED_METRICS/);
 });
 test('financial analysis UI cannot label an unverified update as saved',()=>{
  const fs=require('fs'),path=require('path');
  const client=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
  const api=fs.readFileSync(path.join(__dirname,'../../v3/api/services.js'),'utf8');
  expect(client).toContain("if(serviceCode==='financial_analysis')");
  expect(client).toContain("id=\"srPrintFinancialAnalysis\"");
  expect(client).toContain("BondsFinancialAnalysisReport.render(payload,lang)");
  expect(api).toContain("FINANCIAL_DATASET_SAVE_UNCONFIRMED");
  expect(api).toContain("FINANCIAL_DATASET_READBACK_MISMATCH");
  expect(api).toContain("readback.input_hash!==inputHash");
  expect(api).toContain('result.body?.result?.engineResults?.[targetProfile?.requirements?.engine_code]?.metrics');
 });
});
