/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../components/service-request.js'),'utf8');
const intake=fs.readFileSync(path.resolve(__dirname,'../../service-request.html'),'utf8');
describe('service request intake before paid execution',()=>{
 test('request-only page posts to the authenticated request endpoint before executing',()=>{
  const submit=source.slice(source.indexOf('async function submit(e){'));
  const requestBranch=submit.indexOf('if(!isServiceWorkspace){');
  const execution=submit.indexOf("fetch('/api/v3/services/execute'");
  expect(requestBranch).toBeGreaterThan(-1);
  expect(execution).toBeGreaterThan(requestBranch);
  expect(submit).toContain("json('/api/v3/services/requests',{");
  expect(submit).toContain("await finalizeServiceRequestCreation(d,values,headers)");
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
 test('workspace execution remains separate from request submission',()=>{
  expect(source).toContain("if(!isServiceWorkspace){");
  expect(source).toContain("fetch('/api/v3/services/execute'");
 });
});
