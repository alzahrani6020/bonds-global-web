/** @jest-environment node */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
const source=read('my-bonds/crm/company-hr-directory-export.js');
describe('HR directory CSV export',()=>{
 test('uses existing owner context, current workspace and read-only paginated data',()=>{
  expect(source).toContain("ctx?.ownerWorkspace?.id");
  expect(source).toContain("if(!ctx?.ownerLicense||!ctx?.user||!ctx?.db||!workspaceId)");
  expect(source).toContain("ctx.db.from('hr_saas_employees')");
  expect(source).toContain(".eq('workspace_id',workspaceId).order('id',{ascending:true})");
  expect(source).toContain(".range(start,start+batchSize-1)");
  expect(source).toContain('if(rows.length>maxRows)throw Error(');
  expect(source).toContain("window.BondsHRContext?.ownerWorkspace?.id!==workspaceId");
  expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
 });
 test('never exports payroll, bank, private contact information or membership rows',()=>{
  expect(source).toContain("['employee_number','full_name','employment_status','hire_date','department','job_title']");
  expect(source).not.toContain("select('*')");
  expect(source).not.toContain("bank_iban");
  expect(source).not.toContain("base_salary");
  expect(source).not.toContain("hr_saas_memberships");
  for(const locale of ['','en/']){
   const html=read(locale+'my-bonds/crm/index.html');
   expect(html).toContain('company-hr-directory-export.js?v=1');
  }
 });
 test('CSV cell encoder neutralizes malicious formulas and escapes quotes',()=>{
  const matched=source.match(/const csvCell=value=>\{([\s\S]*?)\n \};/);
  expect(matched).not.toBeNull();
  const cell=vm.runInNewContext('((value)=>{'+matched[1]+'})');
  expect(cell('=HYPERLINK("https://example.com")')).toBe('"\'=HYPERLINK(""https://example.com"")"');
  expect(cell('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"');
  expect(cell('@evil')).toBe('"\'@evil"');
  expect(cell('Normal, "Quoted"')).toBe('"Normal, ""Quoted"""');
 });
});
