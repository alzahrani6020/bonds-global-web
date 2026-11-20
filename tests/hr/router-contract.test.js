'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
describe('Independent HR API without extra Vercel serverless entrypoints',()=>{
 test('HR endpoints use the existing secure API routers and retain a twelve-function budget',()=>{
  const rules=JSON.parse(read('vercel.json')).rewrites;
  const expectRoute=(source,destination)=>{
   const matching=rules.filter(rule=>rule.source===source);
   expect(matching).toHaveLength(1);
   expect(matching[0].destination).toBe(destination);
  };
  expectRoute('/api/company-programs','/api/payments');
  expectRoute('/api/hr-calculations','/api/platform');
  const payments=read('api/payments.js'),platform=read('api/platform.js');
  expect(payments).toContain("require('../lib/api/company-programs')(req, res)");
  expect(platform).toContain("require('../lib/api/hr-calculations')(req, res)");
  expect(payments).toContain('bodyParser: false');
  expect(fs.existsSync(path.join(root,'lib/api/company-programs.js'))).toBe(true);
  expect(fs.existsSync(path.join(root,'lib/api/hr-calculations.js'))).toBe(true);
  expect(fs.existsSync(path.join(root,'api/company-programs.js'))).toBe(false);
  expect(fs.existsSync(path.join(root,'api/hr-calculations.js'))).toBe(false);
 });
 test('neither module changes legacy CRM subscription and billing tables',()=>{
  const billing=read('lib/api/company-programs.js');
  const calculator=read('lib/api/hr-calculations.js');
  expect(billing).toContain('company_program_apply_stripe_event');
  expect(billing).not.toContain("from('subscriptions')");
  expect(calculator).toContain('hr_saas_calculation_drafts');
  expect(calculator).not.toContain("from('crm_app_workspaces')");
 });
});
