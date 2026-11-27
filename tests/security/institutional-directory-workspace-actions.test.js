'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const directory=file('components/institutional-directory-ui.js');
const crm=file('my-bonds/crm/crm-app.js');
const importer=file('components/institutional-directory-import.js');
const ar=file('institutional-directory.html');
const en=file('en/institutional-directory.html');
describe('BONDS institutional directory and CRM workspace action wiring',()=>{
 test('all visible directory actions have handlers and disabled initial state',()=>{
  for(const page of [ar,en]){
   for(const id of ['directory-refresh-workspaces','directory-signin-link','crm-workspace-link','institutional-entry-form','institutional-preview-entry','institutional-preview-csv','institutional-apply','search-directory']){
    expect(page).toContain('id="'+id+'"');
   }
   for(const id of ['institutional-preview-entry','institutional-preview-csv','institutional-apply','search-directory']){
    expect(page).toMatch(new RegExp('id="'+id+'"[^>]*disabled'));
   }
   expect(page).toContain('institutional-directory-ui.js?v=2');
  }
  expect(directory).toContain("refresh.addEventListener('click'");
  expect(directory).toContain("form.addEventListener('submit'");
  expect(importer).toContain("'institutional-preview-csv').addEventListener('click'");
  expect(importer).toContain("'institutional-apply').addEventListener('click'");
 });
 test('workspace context is passed in both directions and validated against visible CRM workspaces',()=>{
  expect(directory).toContain("get('workspace_id')");
  expect(directory).toContain('spaces.find(w => w.id === requested)');
  expect(directory).toContain("setWorkspaceReady(Boolean(sb && select.value))");
  expect(directory).toContain("encodeURIComponent(select.value)");
  expect(directory).toContain("english ? '/en/my-bonds/crm/' : '/my-bonds/crm/'");
  expect(crm).toContain("get('workspace_id')");
  expect(crm).toContain("spaces.find(w=>w.id===requestedWorkspaceId.toLowerCase())");
  expect(crm).toContain("encodeURIComponent(workspace.id)");
  expect(crm).toContain("directoryLink.addEventListener('click'");
  expect(crm).toContain("acceptedWorkspaceId)||requestedWorkspace||");
 });
 test('does not create users, memberships or bypass authenticated tenant access',()=>{
  expect(directory).toContain("sb.auth.getUser()");
  expect(directory).toContain("sb.from('crm_app_workspaces')");
  expect(directory).toContain("/api/institutional-directory?");
  expect(directory).not.toMatch(/\.insert\(|\.upsert\(|\.delete\(/);
  expect(importer).toContain('workspace_id:workspaceId');
  expect(importer).not.toContain("crm_app_members').insert");
  expect(crm).not.toContain("requestedWorkspaceId}).insert");
 });
 test('CRM has bilingual links and cache-busted script',()=>{
  for(const [page,link] of [['my-bonds/crm/index.html','/institutional-directory.html'],['en/my-bonds/crm/index.html','/en/institutional-directory.html']]){
   const html=file(page);
   expect(html).toContain('id="crm-directory-link"');
   expect(html).toContain('href="'+link+'"');
   expect(html).toContain('/my-bonds/crm/crm-app.js?v=4');
  }
 });
});