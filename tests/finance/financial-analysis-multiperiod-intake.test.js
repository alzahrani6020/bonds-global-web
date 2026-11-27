'use strict';
const {extractFinancialFields}=require('../../lib/finance/financial-data-intake');
const run=rows=>extractFinancialFields({parsed:{rows,sheet_name:'Statement'},primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
describe('financial-analysis dated columns - source anchored comparisons',()=>{
 test('extracts explicitly dated 2026 and 2025 columns, never conflates comparisons',()=>{
  const d=run([['البيان','2026','2025'],
   ['Revenue',2000000,1800000],
   ['Net Income',225000,180000],
   ['Current Assets',400000,350000],
   ['Current Liabilities',200000,150000]]);
  expect(d.values).toMatchObject({revenue:2000000,prior_revenue:1800000,
   net_income:225000,prior_net_income:180000,current_assets:400000,current_liabilities:200000});
  expect(d.validation.valid).toBe(true);
  expect(d.validation.warnings.some(w=>w.code==='PERIOD_MISMATCH')).toBe(false);
  const revenue=d.fields.find(x=>x.field==='revenue');
  expect(revenue.status).toBe('extracted_multi_period');
  expect(revenue.period).toBe('2026');
  expect(revenue.period_values).toEqual({'2025':1800000,'2026':2000000});
  const previous=d.fields.find(x=>x.field==='prior_revenue');
  expect(previous).toMatchObject({status:'extracted_comparative',period:'2025',value:1800000});
  expect(previous.source[0]).toMatchObject({row:2,column:3,period:'2025'});
 });
 test('latest year can be right of prior year; never select the first numeric column',()=>{
  const d=run([['Description','2025','2026'],
   ['Revenue',1800000,2000000],
   ['Net Income',180000,225000],
   ['Current Assets',350000,400000],
   ['Current Liabilities',150000,200000]]);
  expect(d.values.revenue).toBe(2000000);
  expect(d.values.prior_revenue).toBe(1800000);
  expect(d.fields.find(x=>x.field==='revenue').period).toBe('2026');
  expect(d.fields.find(x=>x.field==='revenue').source.some(x=>x.column===3)).toBe(true);
 });
 test('missing latest-year amount cannot be substituted with older year',()=>{
  const d=run([['البيان','2026','2025'],
   ['Revenue',2000000,1800000],
   ['Current Assets','',350000],
   ['Current Liabilities',200000,150000]]);
  expect(d.values.current_assets).toBeUndefined();
  expect(d.validation.valid).toBe(false);
  expect(d.validation.missing).toContain('current_assets');
 });
 test('without dated headers different values are a conflict, not a guessed current period',()=>{
  const d=run([['Revenue',2000000,1800000],
    ['Current Assets',400000],['Current Liabilities',200000]]);
  expect(d.values.revenue).toBeUndefined();
  expect(d.fields.find(x=>x.field==='revenue').status).toBe('conflict');
  expect(d.validation.valid).toBe(false);
 });
 test('single column intake remains functional and does not synthesize prior year',()=>{
  const d=run([['Revenue',2000000],['Current Assets',400000],['Current Liabilities',200000]]);
  expect(d.validation.valid).toBe(true);
  expect(d.values.prior_revenue).toBeUndefined();
  expect(d.values.revenue).toBe(2000000);
 });
 test('PDF text extracts explicit dated Arabic comparative columns without inventing values',()=>{
  const d=extractFinancialFields({
    parsed:{text:['قائمة الدخل','البيان 2025 2024','الإيرادات 2,000,000 1,800,000','صافي الربح 225,000 180,000','الأصول المتداولة 400,000 350,000','الالتزامات المتداولة 200,000 150,000'].join('\n')},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'
  });
  expect(d.values).toMatchObject({revenue:2000000,prior_revenue:1800000,net_income:225000,prior_net_income:180000});
  const revenue=d.fields.find(x=>x.field==='revenue');
  expect(revenue.status).toBe('extracted_multi_period');
  expect(revenue.period_values).toEqual({'2025':2000000,'2024':1800000});
  expect(revenue.source).toEqual(expect.arrayContaining([expect.objectContaining({line:3,column:1,period:'2025',header_line:2})]));
 });
 test('PDF with two undated amount columns does not choose one',()=>{
  const d=extractFinancialFields({
    parsed:{text:'الإيرادات 2,000,000 1,800,000\nالأصول المتداولة 400,000\nالالتزامات المتداولة 200,000'},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'
  });
  expect(d.values.revenue).toBeUndefined();
  expect(d.fields.find(x=>x.field==='revenue').status).toBe('conflict');
 });
 test('PDF dated column header expires rather than binding unrelated later figures',()=>{
  const lines=['البيان 2025 2024', ...Array(42).fill('ملاحظات'), 'الإيرادات 200 100'];
  const d=extractFinancialFields({parsed:{text:lines.join('\n')},primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(d.values.revenue).toBeUndefined();
  expect(d.fields.find(x=>x.field==='revenue').status).toBe('conflict');
 });
 test('non-financial-analysis services keep their original field extraction contract',()=>{
  const d=extractFinancialFields({
   parsed:{rows:[['Revenue',2000000],['Current Assets',400000],['Current Liabilities',200000]]},
   primaryAction:'financial_analysis_run',serviceCode:'liquidity_analysis'
  });
  expect(d.values).toMatchObject({current_assets:400000,current_liabilities:200000});
  expect(d.requirement_fields).not.toContain('prior_revenue');
 });
});
