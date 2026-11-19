/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
const ar=read('my-bonds/crm/index.html');
const en=read('en/my-bonds/crm/index.html');
const internal=read('my-bonds/crm/crm-internal.js');
const header=read('site-layout.js');
describe('Single CRM shell with isolated administrative operations',()=>{
 test('the public company programs menu contains just one CRM destination',()=>{
  const match=header.match(/const companyProgramsDropdown = \[([\s\S]*?)\];/);
  expect(match).not.toBeNull();
  expect(match[1]).not.toContain('/admin/crm.html');
  expect(match[1]).toContain('/my-bonds/crm/');
  expect((match[1].match(/label:/g)||[]).length).toBe(3);
  expect(match[1]).toContain('/my-bonds/crm/?program=hr');
  expect(match[1]).toContain("'/en/my-bonds/crm/'");
  expect(match[1]).toContain("'/my-bonds/crm/'");
 });
 test('administrative records are accessed inside both CRM languages, not via public data joins',()=>{
  for(const page of [ar,en]){
   for(const id of ['internal-crm-open','internal-crm-panel','internal-crm-requests','internal-crm-deals','internal-crm-clients','internal-crm-lifecycle','internal-crm-editor','internal-crm-organizations','internal-crm-activities'])
    expect(page).toContain('id="'+id+'"');
   expect(page).toContain('crm-internal.js?v=1');
  }
  expect(internal).toContain("api('crm-overview')");
  expect(internal).toContain("api('service-request-status-update'");
  expect(internal).not.toContain("sb.from('crm_app_");
  expect(internal).not.toContain('service_role');
 });
 test('legacy CRM URL routes to integrated mode without dropping protected admin API',()=>{
  expect(read('admin/crm.html')).toContain("window.location.replace('/my-bonds/crm/?internal=1')");
  expect(internal).toContain("get('internal')==='1'");
  expect(internal).toContain("open.click()");
  expect(internal).toContain("el('onboarding').hidden=true");
 });
 test('internal mode waits for customer workspace initialization to prevent overlapping screens',()=>{
  expect(read('my-bonds/crm/crm-app.js')).toContain("document.dispatchEvent(new Event('bonds-crm-workspace-initialized'))");
  expect(internal).toContain("document.addEventListener('bonds-crm-workspace-initialized',initialize,{once:true})");
 });
 test('internal panel is permission gated before becoming visible',()=>{
  expect(internal).toContain('if(!auth.data?.user)return');
  expect(internal).toContain("const data=await api('crm-overview')");
  expect(internal).toContain('ready=true;open.hidden=false');
  expect(internal).toContain('open.hidden=true;ready=false');
  expect(ar).toContain('id="internal-crm-open" class="secondary" hidden');
  expect(en).toContain('id="internal-crm-open" class="secondary" hidden');
 });
 test('internal CRUD is delegated to existing permission-checked administrative endpoints',()=>{
  const api=read('api/admin.js');
  for(const action of ['crm-client-create','crm-client-update','crm-organization-create','crm-organization-update','crm-opportunity-create','crm-opportunity-update','crm-activity-create','crm-activity-update','service-request-status-update']){
   expect(internal).toContain("'"+action+"'");
   expect(api).toContain("action === '"+action+"'");
  }
  expect(internal).not.toMatch(/localStorage\.|sessionStorage\./);
  expect(internal).not.toMatch(/\bDELETE\s+FROM\b|\.delete\(/i);
 });
});
