/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/company-hr.js'),'utf8');
describe('HR employee directory incremental enhancements',()=>{
 test('employee filters only affect the employee directory and use safe text rendering',()=>{
  expect(source).toContain("ensureEmployeeFilters().hidden=!isEmployees");
  expect(source).toContain("employees.filter(e=>");
  expect(source).toContain("employeeStatusFilter!=='all'");
  expect(source).toContain("String(value??'').toLocaleLowerCase().includes(employeeSearch)");
  expect(source).toContain("search.addEventListener('input'");
  expect(source).toContain("select.addEventListener('change'");
  expect(source).toContain("return '<td>'+escape(value??'—')+'</td>'");
 });
 test('discloses the bounded fetch rather than presenting 250 as total population',()=>{
  expect(source).toContain(".limit(250)");
  expect(source).toContain("employees.length===250");
  expect(source).toContain("first 250 records only");
 });
 test('clears employee search and status when switching company',()=>{
  expect(source).toContain("employeeSearch='';employeeStatusFilter='all';");
  expect(source).toContain("if($('hr-employee-search'))$('hr-employee-search').value=''");
  expect(source).toContain("if($('hr-employee-status-filter'))$('hr-employee-status-filter').value='all'");
 });
 test('does not introduce any new privileged operation or payment route',()=>{
  expect(source).not.toMatch(/service_role|\.from\('hr_saas_employees'\)\.delete\(/);
  expect(source).toContain("const result=check(await q.select('id').single())");
 });
});
