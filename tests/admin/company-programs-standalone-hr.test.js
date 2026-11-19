/** @jest-environment node */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('independent CRM/HR products in one company programs dashboard',()=>{
 const ar=read('my-bonds/crm/index.html'),en=read('en/my-bonds/crm/index.html');
 const controller=read('my-bonds/crm/company-hr.js');
 const sql=read('supabase/migrations/20261117040000_standalone_hr_saas_baseline.sql');
 test('CRM and HR are separate products within exactly the same AR/EN dashboard',()=>{
  for(const html of [ar,en]){
   expect(html).toContain('id="crm-product-tab"');
   expect(html).toContain('id="hr-product-tab"');
   expect(html).toContain('id="hr-nav" hidden');
   expect(html).toContain('id="crm-nav"');
   expect(html).toContain('id="hr-section" hidden');
   expect(html).toMatch(/company-hr\.js\?v=\d+/);
  }
  expect(read('site-layout.js')).toContain('/my-bonds/crm/?program=hr');
  expect(read('site-layout.js')).toContain("'/my-bonds/crm/'");
 });
 test('HR tables are independent of CRM tenancy, employee references cannot cross workspaces',()=>{
  for(const name of ['hr_saas_workspaces','hr_saas_employees','hr_saas_records','hr_saas_audit'])
   expect(sql).toContain('create table public.'+name);
  expect(sql).not.toContain('references public.crm_app_');
  expect(sql).toContain('foreign key(workspace_id,employee_id)');
  expect(sql).toContain('references public.hr_saas_employees(workspace_id,id)');
 });
 test('purchase grants cannot be forged by browser or a CRM membership',()=>{
  expect(sql).toContain('company_program_entitlements');
  expect(sql).toContain("'crm','hr','finance','suite'");
  expect(sql).toContain('grant select on public.company_program_entitlements to authenticated');
  expect(sql).not.toMatch(/grant\s+(?:all|insert|update|delete)\s+on\s+public\.company_program_entitlements\s+to\s+authenticated/i);
  expect(sql).toContain("e.product_code in ('hr','suite')");
  expect(sql).toContain("e.status in ('active','trial')");
  expect(sql).toContain('alter table public.hr_saas_records enable row level security');
  expect(controller).not.toMatch(/\.from\('company_program_entitlements'\)\.insert/);
  expect(controller).toContain("if(!license)return");
 });
 test('HR actions use HR tables with explicit workspace scoping and no direct payments',()=>{
  expect(controller).toContain("db.from('hr_saas_employees')");
  expect(controller).toContain("db.from('hr_saas_records')");
  expect(controller).toContain(".eq('workspace_id',owner)");
  expect(controller).toContain(".eq('workspace_id',workspace.id)");
  // CRM supplies only the shared company identity; HR data stays in HR tables.
  expect(controller).toContain("db.from('crm_app_workspaces')");
  for(const forbidden of ['crm_app_contacts','crm_app_deals','crm_app_companies',
    'crm_app_activities','crm_app_renewals','crm_app_members']){
    expect(controller).not.toContain("db.from('"+forbidden+"')");
  }
  const shared=read('supabase/migrations/20261118010000_hr_link_existing_company_workspaces.sql');
  expect(shared).toContain('foreign key(crm_workspace_id)');
  expect(shared).toContain('references public.crm_app_workspaces(id) on delete restrict');
  expect(shared).toContain('assert_crm_workspace_owner()');
  expect(shared).toContain('c.id=new.crm_workspace_id and c.owner_user_id=new.owner_user_id');
  expect(shared).toContain('hr_saas_workspace_owner_guard');
  expect(shared).toContain('prevent_workspace_reassignment()');
  expect(shared).toContain('unique(crm_workspace_id)');
  expect(controller).not.toMatch(/service_role|stripe\.charges|payment_intents\.create/);
  for(const name of ['attendance','contracts','leaves','payroll','claims','performance','training','settlements','audit'])
    expect(controller).toContain("'"+name+"'");
 });
 test('migration is non-destructive and remains strict about HR owner and employee roles',()=>{
  expect(sql).toContain('owner_user_id=(select auth.uid())');
  expect(sql).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from/i);
  expect(sql).not.toContain('on delete cascade');
  expect(sql).toContain('hr_saas_private.audit_change()');
  expect(sql).toContain('revoke all on function hr_saas_private.audit_change() from public,anon,authenticated');
 });
});
