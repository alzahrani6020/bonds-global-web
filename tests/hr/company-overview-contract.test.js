/** Company overview regression: exact navigation, safe read-only tenant stats, both locales. */
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
describe('HR company overview integration',()=>{
 const js=read('my-bonds/crm/company-hr-overview.js');
 const ar=read('my-bonds/crm/index.html');
 const en=read('en/my-bonds/crm/index.html');
 const css=read('my-bonds/crm/crm-app.css');
 test('both locales register the shared overview script after the HR controller',()=>{
  for(const html of [ar,en]){
   expect(html).toContain('/my-bonds/crm/company-hr-overview.js?v=1');
   expect(html.indexOf('company-hr-overview.js')).toBeGreaterThan(html.indexOf('company-hr.js'));
  }
 });
 test('small, medium, large and enterprise views retain all existing 26 modules',()=>{
  expect(js).toContain("const sizes=['small','medium','large','giant']");
  for(const module of ['employees','departments','positions','recruitment','lifecycle','shifts','attendance','attendance_corrections','leaves','leave_balances','contracts','payroll','payroll_runs','allowances','deductions','benefits','claims','loans','settlements','performance','training','documents','employee_requests','assets','governance','audit']){
   expect(js).toContain("'"+module+"'");
  }
  expect(js).not.toContain('window.location.assign');
 });
 test('overview statistics never issue unscoped or write queries',()=>{
  expect(js).toContain(".eq('workspace_id',workspaceId)");
  expect(js).toContain("{count:'exact',head:true}");
  expect(js).toContain("if(!context?.ownerLicense||!context?.ownerWorkspace||!context?.db||!context?.user)");
  expect(js).toContain("current=null;section.hidden=false");
  expect(js).toContain("document.getElementById('hr-overview-refresh').disabled=true");
  expect(js).not.toMatch(/\.insert\(|\.update\(|\.delete\(|service_role/);
  expect(js).toContain("Promise.allSettled");
 });
 test('responsive cards and navigation are defined',()=>{
  expect(css).toContain('.hr-overview-directory');
  expect(css).toContain('.hr-overview-stats');
  expect(css).toContain('@media(max-width:600px)');
 });
});
describe('structured HR shift scheduling',()=>{
 const js=read('my-bonds/crm/company-hr.js');
 const css=read('my-bonds/crm/crm-app.css');
 test('shift schedule input includes the full seven-day week',()=>{
  expect(js).toContain("shifts:[['employee_id'");
  expect(js).toContain("type==='weekday-list'");
  expect(js).toContain("['7',t('الأحد','Sun')]");
  expect(css).toContain('.hr-weekday-choices');
 });
 test('shift save validates timezone and days and persists metadata, not invented SQL columns',()=>{
  expect(js).toContain("if(category==='shifts')");
  expect(js).toContain("new Intl.DateTimeFormat('en',{timeZone:tz})");
  expect(js).toContain("new Set(days).size!==days.length");
  expect(js).toContain("row.details={...(editing?.details||{}),...(row.details||{})");
  expect(js).toContain("delete row[field]");
  expect(js).toContain("db.from(table()).insert(row)");
 });
});
