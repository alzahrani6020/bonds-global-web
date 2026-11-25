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
  expect(source).toContain("fetchedEmployeeTotal=response.count??0");
  expect(source).toContain("employeeTotal=fetchedEmployeeTotal");
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
 test('employee writes must be re-read from the same tenant and values matched before success',()=>{
  expect(source).toContain("const persisted=check(await db.from('hr_saas_employees')");
  expect(source).toContain(".select('*').eq('workspace_id',workspace.id).eq('id',result.id).single()");
  expect(source).toContain("persisted.workspace_id!==workspace.id");
  expect(source).toContain("const verifyFields=['employee_number','full_name'");
  expect(source).toContain("'department_id','position_id','email','phone'");
  expect(source).toContain("'hire_date','termination_date','employment_status','basic_salary','salary_currency'");
  expect(source).toContain("verifyFields.some(name=>!matches(name))");
  expect(source).toContain("لا تعِد الإضافة قبل مراجعة السجل");
 });
 test('missing HR authorization identifies the signed-in account and offers account switching',()=>{
  expect(source).toContain("hr-license-current-account");
  expect(source).toContain("user.email");
  expect(source).toContain("hr-switch-account");
  expect(source).toContain("encodeURIComponent(location.pathname+location.search)");
 });
 test('verified super admin can enter HR without checkout while ordinary entitlement checks remain',()=>{
  expect(source).toContain("const ownerRole=await db.rpc('is_super_admin')");
  expect(source).toContain("const verifiedOwner=!ownerRole.error&&ownerRole.data===true");
  expect(source).toContain("if(verifiedOwner){");
  expect(source).toContain("license=true;");
  expect(source).toContain("db.from('company_program_entitlements')");
  expect(source).toContain("if(!license)return;");
  expect(source).not.toMatch(/user_metadata.*super_admin/);
 });
 test('non-directory employee selectors remain bounded and existing writes stay intact',()=>{
  expect(source).toContain(".limit(250)");
  expect(source).toContain("const result=check(await q.select('id').single())");
  expect(source).not.toMatch(/service_role|\.from\('hr_saas_employees'\)\.delete\(/);
 });
});
