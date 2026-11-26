/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=filename=>fs.readFileSync(path.join(__dirname,'../..',filename),'utf8');
const api=read('api/admin.js');
const ui=read('admin/commercial-systems.html');
const source=api.slice(api.indexOf('async function getHrAdminOverview(sb) {'),api.indexOf('\nasync function getCrmOverview(sb) {'));
const getHrAdminOverview=vm.runInNewContext('('+source+')');

function supabaseMock({unavailable=[]}={}){
 const calls=[];
 const db={
  from(table){
   const call={table,field:null,countOpts:null,status:null};
   calls.push(call);
   const query={
    select(field,options){call.field=field;call.countOpts=options;return this;},
    eq(field,value){if(field==='status')call.status=value;return this;},
    then(resolve,reject){const item=unavailable.includes(table)?{error:{code:'PGRST_ERROR'},count:null}:{error:null,count:table==='hr_saas_workspaces'?2:5};return Promise.resolve(item).then(resolve,reject);}
   };
   return query;
  }
 };
 return {db,calls};
}
describe('platform-operator HR aggregate overview',()=>{
 test('endpoint is authorization-gated before any aggregate read',()=>{
  const r=api.indexOf("if (action === 'hr-overview')");
  expect(r).toBeGreaterThan(0);
  const block=api.slice(r,api.indexOf("if (action === 'crm-overview')",r));
  expect(block).toContain("await requireAdminPermission(req, sb, 'observability.read')");
  expect(block.indexOf('requireAdminPermission')).toBeLessThan(block.indexOf('getHrAdminOverview(sb)'));
  expect(block).toContain('return res.status(200).json(await getHrAdminOverview(sb))');
 });
 test('only exact head-only aggregate counts are returned, with no individual employee data',async()=>{
  const {db,calls}=supabaseMock();
  const result=await getHrAdminOverview(db);
  expect(result.success).toBe(true);
  expect(result.degraded).toBe(false);
  expect(result.unavailable).toEqual([]);
  expect(Object.keys(result.counts)).toEqual(['workspaces','employees','memberships','companyProfiles','pendingInvitations','pendingLeaves','draftPayrollPeriods']);
  expect(result.counts.workspaces).toBe(2);
  expect(result.counts.employees).toBe(5);
  expect(calls).toHaveLength(7);
  expect(calls.every(c=>c.countOpts.count==='exact'&&c.countOpts.head===true)).toBe(true);
  expect(calls.find(c=>c.table==='hr_saas_invitations').status).toBe('pending');
  expect(calls.find(c=>c.table==='hr_saas_payroll_periods').status).toBe('draft');
  expect(calls.find(c=>c.table==='hr_saas_leave_requests').status).toBe('pending');
  expect(JSON.stringify(result)).not.toContain('email');
 });
 test('missing counts stay null instead of zero and do not hide other counts',async()=>{
  const {db}=supabaseMock({unavailable:['hr_company_profiles']});
  const result=await getHrAdminOverview(db);
  expect(result.degraded).toBe(true);
  expect(result.counts.companyProfiles).toBeNull();
  expect(result.unavailable).toEqual(['companyProfiles']);
  expect(result.counts.workspaces).toBe(2);
 });
 test('owner page renders HR as aggregate-only and never sends write methods',()=>{
  expect(ui).toContain('/api/admin?action=hr-overview');
  expect(ui).toContain('Number.isInteger(n)&&n>=0');
  expect(ui).toContain('hr-metrics');
  expect(ui).toContain('BondsAuth.initAdminGuard()');
  expect(ui).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  expect(ui).toContain('const hrRequest=loadHr()');
 });
});
