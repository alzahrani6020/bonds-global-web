/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'my-bonds/company-programs/app.js'),'utf8');
const api=fs.readFileSync(path.join(root,'lib/api/company-programs.js'),'utf8');
const tests=fs.readFileSync(path.join(root,'tests/company-programs/company-programs-endpoint.test.js'),'utf8');
const ar=fs.readFileSync(path.join(root,'my-bonds/company-programs/index.html'),'utf8');
const en=fs.readFileSync(path.join(root,'en/my-bonds/company-programs/index.html'),'utf8');
test('task form is present in Arabic and English but initially hidden',()=>{
 for(const html of [ar,en]){
  expect(html).toContain('id="task-create-panel"');
  expect(html).toContain('id="task-create-panel" class="panel" hidden');
  expect(html).toContain('id="task-create-form"');
  expect(html).toContain('id="task-title"');
  expect(html).toContain('id="task-description"');
 }
});
test('task creation is guarded by stage capability, subscription and workspace generation',()=>{
 expect(app).toContain("window.currentInventory?.stagingTaskCreateAvailable!==true");
 expect(app).toContain("p.key==='projects'&&p.entitled");
 expect(app).toContain("if(!sameWorkspace(workspace,epoch))return");
 expect(app).toContain("program_key:'projects',operation:'projects.tasks.create'");
 expect(app).toContain("result.persisted!==true");
 expect(app).toContain("result.tokenExposed!==false");
 expect(app).toContain("result.record.title!==title");
 expect(app).not.toMatch(/innerHTML\s*=/);
 expect(()=>new Function(app)).not.toThrow();
});
test('server never enables stage write capability in production and insists on owner/admin',()=>{
 expect(api).toContain("process.env.VERCEL_ENV==='preview'");
 expect(api).toContain("process.env.BONDS_MAKKIN_STAGING_WRITES_ENABLED==='true'");
 expect(api).toContain("['owner','admin'].includes(access.role)");
 expect(api).toContain("isActiveEntitlement(byKey.get('projects'))");
 expect(api).toContain("process.env.VERCEL_ENV!=='preview'");
 expect(api).toContain("STAGING_WRITES_DISABLED");
 expect(api).toContain("WORKSPACE_WRITE_ROLE_REQUIRED");
 expect(tests).toContain("STAGING_WRITES_DISABLED");
});
