'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const page=fs.readFileSync(path.join(root,'institutional-directory.html'),'utf8');
const client=fs.readFileSync(path.join(root,'components/institutional-directory-ui.js'),'utf8');
const correspondence=fs.readFileSync(path.join(root,'components/correspondence-workspace-ui.js'),'utf8');
describe('Institutional directory presentation cannot bypass tenant API',()=>{
 test('is discoverable from correspondence without replacing its governed actions',()=>{
  expect(correspondence).toContain("window.location.assign('/institutional-directory.html')");
  expect(page).toContain('id="workspace-select"');
  expect(page).toContain('id="entity-type"');
  expect(page).toContain('id="directory-results"');
 });
 test('uses existing RLS-backed CRM session and server bearer authorization',()=>{
  expect(client).toContain('window.BondsAuth.getSupabase()');
  expect(client).toContain("sb.from('crm_app_workspaces')");
  expect(client).toContain('/api/institutional-directory?');
  expect(client).toContain("'Authorization':'Bearer ' + token");
  expect(client).toContain("cache:'no-store'");
 });
 test('renders untrusted fields safely, without retaining contacts client-side',()=>{
  expect(client).toContain('el.textContent = String(value)');
  expect(client).toContain('results.replaceChildren()');
  expect(client).not.toMatch(/\.innerHTML\s*=/);
  expect(client).not.toContain('localStorage');
  expect(client).not.toContain('sessionStorage');
  expect(client).not.toMatch(/sendEmail|smtp|zoho\.send/i);
 });
 test('does not claim mail dispatch or create database records',()=>{
  expect(page).toContain('قراءة فقط');
  expect(client).not.toMatch(/\.insert\(|\.update\(|\.delete\(|method:\s*'POST'/);
  expect(page).not.toContain('data-demo=');
 });
});
