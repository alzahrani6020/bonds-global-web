/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../components/service-request.js'),'utf8');
const intake=fs.readFileSync(path.resolve(__dirname,'../../service-request.html'),'utf8');
const api=fs.readFileSync(path.resolve(__dirname,'../../v3/api/services.js'),'utf8');
describe('service request intake before paid execution',()=>{
 test('request-only page posts to the authenticated request endpoint before executing',()=>{
  const submit=source.slice(source.indexOf('async function submit(e){'));
  const requestBranch=submit.indexOf('if(!isServiceWorkspace){');
  const execution=submit.indexOf("fetch('/api/v3/services/execute'");
  expect(requestBranch).toBeGreaterThan(-1);
  expect(execution).toBeGreaterThan(requestBranch);
  expect(submit).toContain("json('/api/v3/services/requests',{");
  expect(submit).toContain("await finalizeServiceRequestCreation(d,values,headers,{},");
  expect(submit).toContain("const files=[...document.querySelectorAll('#srRequestForm input[type=\"file\"]')]");
 });
 test('service page still exposes the form rather than a checkout button',()=>{
  expect(intake).toContain('id="srRequestForm"');
  expect(intake).toContain('id="srSubmit"');
  expect(intake).not.toContain('id="hr-checkout-start"');
 });
 test('intake inputs persist through login in a tab-scoped draft',()=>{
  expect(source).toContain("const workspaceDraftStorage=(!isServiceWorkspace");
  for(const action of ['saveWorkspaceDraft','restoreWorkspaceDraft','bindWorkspaceDraft','clearWorkspaceDraft']){
   const text=source.slice(source.indexOf('function '+action+'(){'));
   expect(text.slice(0,180)).not.toContain('if(!isServiceWorkspace)return;');
  }
  expect(source).toContain("form.addEventListener('input',saveWorkspaceDraft)");
 });
 test('intake chooses workspace, binds its ID, and checks persisted workspace on readback',()=>{
  expect(source).toContain('async function renderRequestWorkspaceSelector()');
  expect(source).toContain("sb.from('crm_app_workspaces')");
  expect(source).toContain("company_id:requestedWorkspace==='personal'?null:requestedWorkspace");
  expect(source).toContain('workspace_scope!==workspaceBinding.scope');
  expect(source).toContain("only.crm_workspace_id||null");
  expect(source).toContain('requestWorkspaceReady');
 });
 test('request and fields commit using a single atomic database transaction',()=>{
  expect(api).toContain(".rpc('create_service_request_atomic',{");
  expect(api).toContain('p_user_id:user.id');
  expect(api).toContain('p_values:body.values');
  const endpoint=api.slice(api.indexOf('async function handleServiceRequests'));
  expect(endpoint).not.toMatch(/\.from\('service_request_values'\)\.insert\(valueRows\)/);
  expect(endpoint).toContain("REQUEST_COMMIT_UNVERIFIED");
 });
 test('workspace and project IDs are returned from the verified columns',()=>{
  expect(api).toContain('workspace_scope: row.metadata?.workspace_scope');
  expect(api).toContain('crm_workspace_id: row.crm_workspace_id || null');
  expect(api).toContain('linked_project_id: row.linked_user_project_id');
 });
 test('workspace execution remains separate from request submission',()=>{
  expect(source).toContain("if(!isServiceWorkspace){");
  expect(source).toContain("fetch('/api/v3/services/execute'");
 });
});
