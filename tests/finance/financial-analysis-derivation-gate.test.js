'use strict';
const {deriveFinancialInputs,validateDataset,qualityStatus} = require('../../lib/finance/financial-data-intake');
const serviceCode='financial_analysis';
const primaryAction='financial_analysis_run';
const evaluate=(values,fields=[])=>validateDataset({primaryAction,serviceCode,values,fields});

describe('financial-analysis deterministic inference and accounting gate',()=>{
 test('derives equity from assets and liabilities with evidence, without inventing debt or EBITDA',()=>{
  const r=deriveFinancialInputs({revenue:2000000,current_assets:150000,current_liabilities:30000,total_assets:440000,total_liabilities:310000});
  expect(r.values.equity).toBe(130000);
  expect(r.values.total_debt).toBeUndefined();
  expect(r.values.ebitda).toBeUndefined();
  expect(r.fields.find(f=>f.field==='equity')).toMatchObject({
    status:'derived',value:130000,depends_on:['total_assets','total_liabilities']
  });
  expect(evaluate(r.values,r.fields).valid).toBe(true);
 });
 test('derives liabilities or assets only from the other two established components',()=>{
  expect(deriveFinancialInputs({total_assets:440000,equity:130000}).values.total_liabilities).toBe(310000);
  expect(deriveFinancialInputs({total_liabilities:310000,equity:130000}).values.total_assets).toBe(440000);
  expect(deriveFinancialInputs({total_assets:440000}).values.equity).toBeUndefined();
 });
 test('derives EBIT from the actual revenue, cost and operating expense inputs',()=>{
  const r=deriveFinancialInputs({revenue:2000000,cogs:600000,operating_expenses:300000});
  expect(r.values.operating_income).toBe(1100000);
  expect(r.fields.find(f=>f.field==='operating_income').formula).toContain('operating_income =');
 });
 test('never overwrites explicitly supplied values, even when contradictory',()=>{
  const original={revenue:2000000,cogs:600000,operating_expenses:300000,operating_income:2000000,
   current_assets:150000,current_liabilities:30000,total_assets:410000,
   total_liabilities:310000,equity:130000,total_debt:450000,ebitda:180000};
  const inferred=deriveFinancialInputs(original);
  expect(inferred.values).toMatchObject(original);
  const v=evaluate(inferred.values,inferred.fields);
  expect(v.valid).toBe(false);
  expect(v.errors.map(e=>e.code)).toEqual(expect.arrayContaining([
   'ACCOUNTING_EQUATION_MISMATCH','DEBT_EXCEEDS_TOTAL_LIABILITIES',
   'EBIT_EXCEEDS_EBITDA','OPERATING_PROFIT_RECONCILIATION_MISMATCH'
  ]));
  expect(qualityStatus({validation:v,fields:inferred.fields,reviewed:true})).not.toBe('verified');
 });
 test('refreshes an inferred field if source values change, retaining manual overrides',()=>{
  const first=deriveFinancialInputs({total_assets:440000,total_liabilities:310000});
  const revised=deriveFinancialInputs({...first.values,total_assets:450000},first.fields);
  expect(revised.values.equity).toBe(140000);
  const override=deriveFinancialInputs({...first.values,total_assets:450000,equity:140000},
   first.fields.map(f=>f.field==='equity'?{...f,status:'corrected'}:f));
  expect(override.values.equity).toBe(140000);
  expect(override.derived.some(f=>f.field==='equity')).toBe(false);
 });
 test('do not allow material discrepancies to be verified even with minimum inputs',()=>{
  const v=evaluate({revenue:2000000,current_assets:150000,current_liabilities:30000,
   total_assets:410000,total_liabilities:310000,equity:130000});
  expect(v.quality_gate).toBe('FAIL_CLOSED');
  expect(v.errors.some(e=>e.code==='ACCOUNTING_EQUATION_MISMATCH')).toBe(true);
 });
 test('API applies inference before both intake preparation and approval; UI locks derived cells',()=>{
  const fs=require('fs'),path=require('path');
  const api=fs.readFileSync(path.join(__dirname,'../../v3/api/services.js'),'utf8');
  const client=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
  expect(api).toContain('const inferred=deriveFinancialInputs(extracted.values');
  expect(api).toContain('const inferred=deriveFinancialInputs(reviewed,fields)');
  expect(client).toContain('data-derived="true" readonly');
  expect(client).toContain("if(input.dataset.derived==='true')return");
 });
});
