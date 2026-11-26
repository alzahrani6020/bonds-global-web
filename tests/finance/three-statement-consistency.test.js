'use strict';
const {auditEquityRollForward}=require('../../lib/finance/three-statement-consistency');
const {validateDataset,extractFinancialFields}=require('../../lib/finance/financial-data-intake');
const {render}=require('../../components/financial-analysis-report');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const check=values=>validateDataset({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis',values,fields:[]});
describe('three-statement equity roll-forward',()=>{
 test('matches explicitly evidenced net income and owner movements',()=>{
  const values={opening_equity:100,net_income:25,owner_contributions:10,owner_distributions:5,other_equity_movements:-2,equity:128};
  expect(auditEquityRollForward(values).status).toBe('PASS');
  expect(check(values).errors.some(e=>e.code==='EQUITY_ROLL_FORWARD_MISMATCH')).toBe(false);
 });
 test('rejects a material unexplained equity variance without altering inputs',()=>{
  const values={opening_equity:100,net_income:25,owner_contributions:10,owner_distributions:5,other_equity_movements:-2,equity:150};
  const before=JSON.stringify(values);
  expect(auditEquityRollForward(values).status).toBe('FAIL');
  expect(check(values).errors.map(e=>e.code)).toContain('EQUITY_ROLL_FORWARD_MISMATCH');
  expect(JSON.stringify(values)).toBe(before);
 });
 test('incomplete movement disclosure stays unverified and is not assumed zero',()=>{
  const values={opening_equity:100,net_income:25,equity:125};
  const result=auditEquityRollForward(values);
  expect(result.status).toBe('UNVERIFIED');
  expect(result.missing).toContain('other_equity_movements');
  expect(check(values).errors.map(e=>e.code)).not.toContain('EQUITY_ROLL_FORWARD_MISMATCH');
 });
 test('extracts explicit equity fields from labelled statement rows',()=>{
  const parsed={rows:[
   ['opening equity','100'],['net income','25'],['owner contributions','10'],
   ['owner distributions','5'],['other equity movements','-2'],['equity','128']
  ],text:''};
  const extracted=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  for(const field of ['opening_equity','owner_contributions','owner_distributions','other_equity_movements']){
   expect(extracted.values[field]).toEqual(expect.any(Number));
  }
  expect(auditEquityRollForward(extracted.values).status).toBe('PASS');
 });
 test('report discloses verified equity identity and unverified omissions',()=>{
  const sample={executed:true,result:{metrics:{net_margin_pct:10}},dataset:{
   inputs_used:{opening_equity:100,net_income:25,owner_contributions:10,
    owner_distributions:5,other_equity_movements:-2,equity:128}
  }};
  expect(render(sample,'en')).toContain('Equity movement reconciliation');
  expect(render(sample,'en')).toContain('PASS');
  delete sample.dataset.inputs_used.owner_distributions;
  expect(render(sample,'en')).toContain('Unverified — missing equity movements');
 });
 test('manual intake makes all equity movements available without requiring invented zeros',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
  for(const key of ['opening_equity','owner_contributions','owner_distributions','other_equity_movements']){
   expect(source).toContain("['"+key+"'");
  }
 });
 test('report bundle executes without Node require in a browser-like VM',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../components/financial-analysis-report.js'),'utf8');
  const ctx={window:{},console};
  vm.runInNewContext(source,ctx,{timeout:1000});
  expect(typeof ctx.window.BondsFinancialAnalysisReport.render).toBe('function');
 });
 test('zero and negative valid amounts are not treated as missing',()=>{
  expect(auditEquityRollForward({opening_equity:0,net_income:-5,owner_contributions:10,owner_distributions:0,other_equity_movements:0,equity:5}).status).toBe('PASS');
 });
});
