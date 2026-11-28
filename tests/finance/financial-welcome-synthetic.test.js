'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {scenarioResult}=require('../../lib/finance/financial-analysis-lab');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');

describe('financial welcome / synthetic experiment contract',()=>{
 test('welcome has two primary actions and does not auto-load saved reports',()=>{
  const ui=read('components/service-request.js');
  expect(ui).toContain("id=\"srWelcomeNew\"");
  expect(ui).toContain("id=\"srWelcomeDemo\"");
  expect(ui).toContain("id=\"srWelcomeWorks\"");
  expect(ui).toContain('function renderFinancialWelcome()');
  expect(ui).toContain('renderFinancialWelcome();');
  expect(ui).not.toContain("restoreSavedFinancialResult({silent:true})");
  expect(ui).toContain("loadFinancialReportHistory();");
 });
 test('demo never invokes database writes or customer data',()=>{
  const api=read('v3/api/services.js');
  const lab=read('components/financial-analysis-lab.js');
  expect(api).toContain("if(path==='/services/financial-analysis/demo')");
  expect(api).toContain("return sendJson(res,200,scenarioResult(scenario,adjustments))");
  expect(lab).toContain("credentials:'omit'");
  expect(lab).toContain('data-demo-adjust');
  const output=scenarioResult('healthy',{revenue:10,cogs:-5,total_debt:5});
  expect(output.non_persistent).toBe(true);
  expect(output.saved).toBe(false);
  expect(output.audit.database_writes).toBe(0);
  expect(output.audit.customer_records_touched).toBe(0);
  expect(output.periods).toHaveLength(3);
  expect(output.adjustments).toEqual({revenue:10,cogs:-5,total_debt:5});
  expect(output.scenario_change).toBe('synthetic_2026_assumption_adjustment');
  expect(output.periods[0].inputs.revenue).toBe(1400000);
  expect(output.periods[2].inputs.revenue).toBe(2090000);
 });
 test('changing assumptions preserves fixed base and accounting balance',()=>{
  const original=scenarioResult('healthy');
  const altered=scenarioResult('healthy',{total_debt:20,revenue:5});
  const again=scenarioResult('healthy');
  expect(original.audit.fingerprint).toBe(again.audit.fingerprint);
  expect(altered.audit.fingerprint).not.toBe(original.audit.fingerprint);
  const latest=altered.periods[2].inputs;
  expect(latest.total_assets).toBeCloseTo(latest.total_liabilities+latest.equity,5);
  expect(altered.periods[2].audit.find(x=>x.code==='BALANCE_SHEET')?.status).not.toBe('FAIL');
 });
 test('invalid or unauthorized synthetic assumptions fail closed',()=>{
  for(const input of [{revenue:100},{revenue:1},{revenue:'10'},{revenue:NaN},{unknown:5},[]]){
   expect(()=>scenarioResult('healthy',input)).toThrow('INVALID_DEMO_ADJUSTMENT');
  }
  expect(()=>scenarioResult('private-customer')).toThrow('UNKNOWN_FINANCIAL_LAB_SCENARIO');
 });
});