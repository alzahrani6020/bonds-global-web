/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/company-hr-self-service.js'),'utf8');
const ar=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/index.html'),'utf8');
const en=fs.readFileSync(path.resolve(__dirname,'../../en/my-bonds/crm/index.html'),'utf8');
describe('HR invitation acceptance compatibility and localized admin UI',()=>{
 test('keeps existing secure RPC, fragment storage, and only clears after accepting',()=>{
  expect(js).toContain("db.rpc('hr_saas_accept_invitation',{invite_token:inviteToken})");
  expect(js).toContain('sessionStorage.setItem(inviteStorageKey,inviteFromFragment)');
  expect(js).toContain('sessionStorage.removeItem(inviteStorageKey)');
  expect(js.indexOf('sessionStorage.removeItem(inviteStorageKey)')).toBeGreaterThan(js.indexOf("db.rpc('hr_saas_accept_invitation'"));
 });
 test('requires explicit action for account switch and preserves token for OAuth redirect',()=>{
  expect(js).toContain("offerAccountSwitch()");
  expect(js).toContain("if(acceptResult.error.code==='42501')");
  expect(js).toContain("button=$('hr-invite-switch')");
  expect(js).toContain('async function switchInviteAccount()');
  expect(js).toContain('await db.auth.signOut()');
  expect(js).toContain('sessionStorage.setItem(inviteStorageKey,inviteToken)');
  expect(js).toContain('/calculators/auth/index.html?redirect=');
  expect(js).not.toContain("if(acceptResult.error)await db.auth.signOut()");
 });
 test('does not create a new invitation while matching pending invitation is active',()=>{
  const begin=js.indexOf('async function createInvitation(event){');
  const part=js.slice(begin,js.indexOf('async function copyInvitation(event){',begin));
  expect(part).toContain(".eq('status','pending')");
  expect(part).toContain(".gt('expires_at',new Date().toISOString())");
  expect(part.indexOf('if(existing.length)')).toBeLessThan(part.indexOf(".from('hr_saas_invitations').insert"));
  expect(part).toContain('sendInvitationEmail(existing[0].id)');
 });
 test('Arabic and English pages expose all invitation columns and safe switch',()=>{
  for(const html of [ar,en]){
   expect(html).toContain('company-hr-self-service.js?v=6');
   expect(html).toContain('id="hr-invite-switch" hidden');
   expect(html).toContain('<th>');
  }
  for(const word of ['تاريخ الدعوة','تاريخ الانتهاء','الغرض','الموظف'])expect(ar).toContain('<th>'+word+'</th>');
  for(const word of ['Invited at','Expires at','Purpose','Employee'])expect(en).toContain('<th>'+word+'</th>');
  expect(js).toContain("esc(localDate(inv.created_at))");
  expect(js).toContain("esc(localDate(inv.expires_at))");
  expect(js).toContain("esc(roleLabel(inv.role))");
  expect(js).toContain("esc(stateLabel(m.status))");
 });
});
