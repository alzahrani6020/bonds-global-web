'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {scenarioResult}=require('../../lib/finance/financial-analysis-lab');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

describe('BONDS financial analysis lab: synthetic and isolated from client data',()=>{
 test('healthy three-year simulation uses actual financial engine and reconciles all statements',()=>{
  const x=scenarioResult('healthy');
  expect(x.mode).toBe('LOCAL_SYNTHETIC_SIMULATION');
  expect(x.non_persistent).toBe(true);
  expect(x.saved).toBe(false);
  expect(x.approved).toBe(false);
  expect(x.audit.database_writes).toBe(0);
  expect(x.audit.customer_records_touched).toBe(0);
  expect(x.periods.map(p=>p.year)).toEqual([2024,2025,2026]);
  expect(x.completeness.consistency).toBe('PASSED');
  x.periods.forEach(p=>{
   expect(p.validation.valid).toBe(true);
   expect(p.audit.every(c=>c.status==='PASS')).toBe(true);
   expect(p.metrics.current_ratio).toBeGreaterThan(0);
   expect(p.metrics.operating_margin_pct).not.toBeNull();
   expect(p.provenance.find(z=>z.field==='operating_income')).toMatchObject({
    origin:'deterministic_formula'
   });
  });
  expect(x.periods[2].working_capital.cash_conversion_cycle_days).toBeCloseTo(23.3965,4);
  expect(x.periods[2].credit.dscr).toBeCloseTo(2.88,4);
  expect(x.benchmarks.applied).toBe(false);
  expect(x.horizontal).toHaveLength(2);
  expect(x.sensitivity.revenue_minus_10_pct).toBe(260000);
 });
 test('distressed scenario computes true losses, liquidity and credit risks',()=>{
  const x=scenarioResult('stressed');
  expect(x.completeness.consistency).toBe('PASSED');
  expect(x.periods[2].metrics.current_ratio).toBeLessThan(1);
  expect(x.periods[2].metrics.operating_margin_pct).toBeLessThan(0);
  expect(x.periods[2].cash_flow.operating).toBeLessThan(0);
  expect(x.periods[2].credit.dscr).toBeLessThan(1);
  expect(x.risk_codes).toEqual(expect.arrayContaining([
   'LOW_CURRENT_RATIO','NEGATIVE_OPERATING_CASH_FLOW',
   'DEBT_SERVICE_SHORTFALL','NET_LOSS'
  ]));
 });
 test('contradictory scenario never receives financial approval or credit conclusion',()=>{
  const x=scenarioResult('inconsistent');
  expect(x.completeness.consistency).toBe('REJECTED');
  expect(x.completeness.analysis_status).toBe('REJECTED');
  expect(x.report_approval).toBe('NOT_APPROVED');
  expect(x.credit_conclusion).toBe('NOT_ELIGIBLE_FOR_CONCLUSION');
  const p=x.periods[2];
  expect(p.validation.valid).toBe(false);
  expect(p.validation.errors.map(e=>e.code)).toEqual(expect.arrayContaining([
   'ACCOUNTING_EQUATION_MISMATCH','DEBT_EXCEEDS_TOTAL_LIABILITIES',
   'EBIT_EXCEEDS_EBITDA','OPERATING_PROFIT_RECONCILIATION_MISMATCH'
  ]));
  expect(p.audit.filter(c=>c.status==='FAIL').length).toBeGreaterThan(2);
 });
 test('repeatability and unknown scenario fail closed',()=>{
  const a=scenarioResult('healthy'),b=scenarioResult('healthy');
  expect(a.audit.fingerprint).toBe(b.audit.fingerprint);
  expect(a.periods[2].metrics).toEqual(b.periods[2].metrics);
  expect(()=>scenarioResult('client-upload')).toThrow('UNKNOWN_FINANCIAL_LAB_SCENARIO');
  expect(()=>scenarioResult('__proto__')).toThrow('UNKNOWN_FINANCIAL_LAB_SCENARIO');
 });
 test('read-only demonstration route has no auth, db, execute, or POST call paths',()=>{
  const api=read('v3/api/services.js');
  const start=api.indexOf("if(path==='/services/financial-analysis/demo')");
  expect(start).toBeGreaterThan(0);
  const end=api.indexOf("if (path === '/services' ||",start);
  const handler=api.slice(start,end);
  expect(handler).toContain("req.method!=='GET'");
  expect(handler).toContain('scenarioResult(scenario,adjustments)');
   expect(handler).toContain('UNKNOWN_DEMO_PARAMETER');
   expect(handler).toContain('INVALID_DEMO_ADJUSTMENT');
  expect(handler).not.toMatch(/\.from\(|\.insert\(|\.update\(|executeService\(/);
  const client=read('components/financial-analysis-lab.js');
  expect(client).toContain("method:'GET'");
  expect(client).toContain("credentials:'omit'");
  expect(client).not.toContain('method:\'POST\'');
  expect(client).not.toContain('localStorage');
  expect(client).not.toContain('sessionStorage');
  expect(client).not.toContain('supabase');
  expect(client).toContain('TEST REPORT');
  expect(client).toContain('srFinanceLabClear');
  const workspace=read('components/service-request.js');
  expect(workspace).toContain("if(serviceCode==='financial_analysis')");
  expect(workspace).toContain('BondsFinancialAnalysisLab?.mount(lab,lang)');
 });
});
