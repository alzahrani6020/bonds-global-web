/** @jest-environment node */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
const code=read('my-bonds/crm/company-hr-employee-360.js');
const directory=read('my-bonds/crm/company-hr.js');
describe('employee 360 existing-workspace read-only contract',()=>{
 test('entry point exists only on employee rows and both languages load same module',()=>{
  expect(directory).toContain("isEmployees?'<button type=\"button\" class=\"secondary\" data-hr-employee-360=");
  for(const lang of ['','en/']){
   const html=read(lang+'my-bonds/crm/index.html');
   expect(html).toContain('company-hr-employee-360.js?v=2');
   expect(html).toContain('company-hr.js?v=21');
  }
 });
 test('all detail reads enforce company and employee IDs while database RLS remains mandatory',()=>{
  expect(code).toContain("const wid=context?.ownerWorkspace?.id");
  expect(code).toContain("if(!context?.ownerLicense||!context?.db||!context?.user||!wid)return");
  expect(code).toContain(".eq('workspace_id',wid).eq('id',employeeId)");
  expect(code).toContain(".eq('workspace_id',wid).eq('employee_id',employeeId)");
  expect(code).toContain("if(run!==revision||window.BondsHRContext?.ownerWorkspace?.id!==wid)return");
  expect(code).toContain("document.addEventListener('bonds-hr-owner-workspace',clear)");
  expect(code).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 });
 test('excludes private employee identifiers, salary and medical data',()=>{
  for(const table of ['hr_saas_employment_contracts','hr_saas_leave_requests','hr_saas_attendance','hr_saas_records'])expect(code).toContain("table:'"+table+"'");
  expect(code).not.toContain('base_salary');
  expect(code).not.toContain('bank_iban');
  expect(code).not.toContain('national_id');
  expect(code).not.toContain('medical_condition');
  expect(code).toContain("limit(20)");
 });
 test('no profile opens before an existing authorized employee is resolved',()=>{
  expect(code).toContain("if(response.error||!response.data||response.data.id!==employeeId)");
  expect(code).toContain("body.textContent=label('تعذر التحقق من ملف الموظف أو صلاحية الوصول'");
  expect(code).toContain('Promise.allSettled(sections.map');
 });
});

describe('employee 360 audit actor/timestamp history',()=>{
 test('reads immutable-to-authenticated audit entries for selected employee, not other workspace rows',()=>{
  expect(code).toContain("context.db.from('hr_saas_audit')");
  expect(code).toContain(".select('created_at,action,actor_user_id')");
  expect(code).toContain(".eq('workspace_id',wid).eq('entity','hr_saas_employees')");
  expect(code).toContain(".eq('entity_id',employeeId).order('created_at',{ascending:false}).limit(20)");
  expect(code).toContain("if(run!==revision||window.BondsHRContext?.ownerWorkspace?.id!==wid)return");
  expect(code).not.toContain("changed_columns");
 });
});
