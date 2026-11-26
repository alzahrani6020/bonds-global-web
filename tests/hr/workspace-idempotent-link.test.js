/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
const js=read('my-bonds/crm/company-hr.js');
const sql=read('supabase/migrations/20261118010000_hr_link_existing_company_workspaces.sql');
describe('HR company workspace concurrent opening',()=>{
 test('unique CRM workspace mapping must remain enforced by database',()=>{
  expect(sql).toMatch(/crm_workspace_id/i);
  expect(js).toContain("if(result.error.code!=='23505')throw result.error");
 });
 test('only a unique conflict can be recovered by re-reading the same company owned by the same user',()=>{
  expect(js).toContain(".eq('crm_workspace_id',selected.id).eq('owner_user_id',user.id)");
  expect(js).toContain("linked.owner_user_id!==user.id||linked.crm_workspace_id!==selected.id");
  expect(js).toContain("if(!workspaces.some(w=>w.id===linked.id))workspaces.push(linked)");
 });
 test('does not insert or modify HR membership or CRM company as part of conflict recovery',()=>{
  const start=js.indexOf('if(selected&&!workspace){');
  const end=js.indexOf("    $('hr-app').hidden=!workspace;",start);
  const block=js.slice(start,end);
  expect(block).toContain("db.from('hr_saas_workspaces').insert(");
  expect(block).not.toContain("hr_saas_memberships");
  expect(block).not.toContain("crm_app_workspaces').insert");
  expect(block).not.toContain(".upsert(");
 });
});
