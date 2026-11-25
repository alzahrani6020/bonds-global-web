'use strict';
const {auditEquityRollForward}=require('../../lib/finance/three-statement-consistency');
const {validateDataset}=require('../../lib/finance/financial-data-intake');
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
 test('zero and negative valid amounts are not treated as missing',()=>{
  expect(auditEquityRollForward({opening_equity:0,net_income:-5,owner_contributions:10,owner_distributions:0,other_equity_movements:0,equity:5}).status).toBe('PASS');
 });
});
