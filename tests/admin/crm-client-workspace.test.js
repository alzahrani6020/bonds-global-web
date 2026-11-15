/** @jest-environment node */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('Customer CRM installable workspace integrity',()=>{
 const html=read('my-bonds/crm/index.html'),js=read('my-bonds/crm/crm-app.js');
 const manifest=JSON.parse(read('my-bonds/crm/crm-manifest.webmanifest'));
 const sql=read('supabase/migrations/20261115020000_crm_client_app_isolated_workspaces.sql');
 test('all locally linked app assets exist and manifest is installable',()=>{
  for(const asset of ['crm-app.js','crm-app.css','crm-manifest.webmanifest'])
    expect(fs.existsSync(path.join(root,'my-bonds/crm',asset))).toBe(true);
  expect(html).toContain('/my-bonds/crm/crm-app.js?v=1');
  expect(manifest.start_url).toMatch(/^\/my-bonds\/crm\//);
  expect(manifest.display).toBe('standalone');
  for(const icon of manifest.icons)expect(fs.existsSync(path.join(root,icon.src.replace(/^\//,'')))).toBe(true);
 });
 test('browser uses signed-in Supabase session and workspace-scoped queries',()=>{
  expect(js).toContain('window.BondsAuth.ensureEnv()');
  expect(js).toContain('sb.auth.getUser()');
  expect(js).toContain(".eq('workspace_id',workspace.id)");
  expect(js).not.toMatch(/localStorage\.setItem|sessionStorage\.setItem|caches\.open/);
 });
 test('all seven client tables use RLS and ownership',()=>{
  for(const table of ['crm_app_workspaces','crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success'])
    expect(sql).toContain(table);
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('owner_user_id=(select auth.uid())');
  expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
 });
});
