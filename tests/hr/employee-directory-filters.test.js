/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/company-hr.js'),'utf8');
describe('HR employee directory server-side paging',()=>{
 test('queries tenant-scoped employees and retrieves an exact total',()=>{
  expect(source).toContain("select('*',{count:'exact'}).eq('workspace_id',owner)");
  expect(source).toContain(".eq('employment_status',employeeStatusFilter)");
  expect(source).toContain(".ilike.");
  expect(source).toContain(".range(start,start+employeePageSize-1)");
  expect(source).toContain("employeePageSize=50");
  expect(source).toContain("employeeTotal=response.count??0");
  expect(source).toContain("order('employee_number',{ascending:true})");
  expect(source).toContain("order('id',{ascending:true})");
 });
 test('search text is sanitized before construction of PostgREST or filters',()=>{
  expect(source).toContain("employeeSearch.replace(");
  expect(source).toContain(".trim().slice(0,80)");
  expect(source).toContain("const pattern='%'+term+'%'");
  expect(source).toContain("query=query.or(");
 });
 test('filters and pagination only apply to the employee directory',()=>{
  expect(source).toContain("ensureEmployeeFilters().hidden=!isEmployees");
  expect(source).toContain("const source=isEmployees?employees:records");
  expect(source).toContain("search.addEventListener('input'");
  expect(source).toContain("select.addEventListener('change'");
  expect(source).toContain("employeePage=0");
  expect(source).toContain("employeeSearch='';employeeStatusFilter='all';employeePage=0;employeeTotal=0;");
 });
 test('non-directory employee selectors remain bounded and existing writes stay intact',()=>{
  expect(source).toContain(".limit(250)");
  expect(source).toContain("const result=check(await q.select('id').single())");
  expect(source).not.toMatch(/service_role|\.from\('hr_saas_employees'\)\.delete\(/);
 });
});
