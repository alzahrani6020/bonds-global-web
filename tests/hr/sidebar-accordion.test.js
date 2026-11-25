/** @jest-environment node */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const english=read('en/my-bonds/crm/index.html');
const arabic=read('my-bonds/crm/index.html');
const controller=read('my-bonds/crm/company-hr.js');
const css=read('my-bonds/crm/crm-app.css');
const groups=['people','time','comp','talent','services','control'];
const modules=['employees','departments','positions','recruitment','lifecycle','attendance','attendance_corrections','shifts','leaves','leave_balances','contracts','payroll','payroll_runs','benefits','allowances','deductions','claims','loans','settlements','performance','training','documents','employee_requests','assets','governance','audit'];
describe('BONDS HR accordion sidebar',()=>{
 for(const [language,html] of [['Arabic',arabic],['English',english]]){
  test(language+' uses six native disclosure groups with 26 distinct modules',()=>{
   expect((html.match(/<details class="hr-nav-group"/g)||[])).toHaveLength(6);
   const nav=html.match(/<nav class="sidebar-nav hr-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
   expect(nav).toBeDefined();
   expect((nav.match(/<summary>/g)||[])).toHaveLength(6);
   for(const group of groups)expect(html).toContain('data-hr-group="'+group+'"');
   const found=[...html.matchAll(/data-hr-category="([^"]+)"/g)].map(x=>x[1]);
   expect(found).toHaveLength(26);
   expect(new Set(found).size).toBe(26);
   expect([...found].sort()).toEqual([...modules].sort());
   expect(html).toContain('company-hr.js?v=19');
   expect(html).toContain('crm-app.css?v=5');
   expect(html).toContain('id="company-program-brand"');
  });
 }
 test('selected module opens group after direct link and browser navigation',()=>{
  expect(controller).toContain("const group=current.closest('details.hr-nav-group')");
  expect(controller).toContain('if(group)group.open=true');
  expect(controller).toContain('syncHrNavigation(category);');
  expect(controller).toContain("syncHrNavigation(labels[category]?category:'employees');");
  expect(controller).toContain("history.pushState(null,'',url.pathname+url.search+url.hash)");
  expect(controller).toContain("window.addEventListener('popstate'");
  expect(controller).toContain("heading.textContent=name==='hr'?'BONDS HR':'BONDS CRM'");
 });
 test('nested scroll is removed and mobile groups remain vertical',()=>{
  expect(css).toContain('#hr-nav.hr-nav{display:flex;flex-direction:column');
  expect(css).toContain('overflow:visible;max-height:none');
  expect(css).toContain('.sidebar{height:100vh;min-height:0;overflow-y:auto;');
  expect(css).toContain('.hr-nav-group>summary:focus-visible');
  expect(css).not.toContain('.hr-nav{max-height:45vh;overflow-y:auto');
 });
});
