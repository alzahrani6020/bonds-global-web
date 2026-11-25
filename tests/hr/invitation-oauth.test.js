/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/company-hr-self-service.js'),'utf8');
const ar=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/index.html'),'utf8');
const en=fs.readFileSync(path.resolve(__dirname,'../../en/my-bonds/crm/index.html'),'utf8');
describe('HR staff invitation survives OAuth return',()=>{
 test('fragment-only invite is kept in sessionStorage until acceptance',()=>{
  expect(source).toContain("new URLSearchParams(location.hash.slice(1)).get('invite')");
  expect(source).toContain("sessionStorage.setItem(inviteStorageKey,inviteFromFragment)");
  expect(source).toContain("sessionStorage.getItem(inviteStorageKey)");
  expect(source).toContain("db.rpc('hr_saas_accept_invitation',{invite_token:inviteToken})");
  const persisted=source.indexOf("sessionStorage.removeItem(inviteStorageKey)");
  const accepted=source.indexOf("const accepted=requireOk(await db.rpc(");
  expect(persisted).toBeGreaterThan(accepted);
  expect(source).toContain("clean.hash='';history.replaceState");
 });
 test('both locale entrypoints use new callback script',()=>{
  for(const html of [ar,en]){
   expect(html).toContain('company-hr-self-service.js?v=5');
   expect(html).toContain('company-hr.js?v=19');
  }
 });
});
