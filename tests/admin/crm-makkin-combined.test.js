/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'../..',f),'utf8');
const html=read('admin/crm.html');
const api=read('api/admin.js');
const script=read('admin/crm-extended.js');
const css=read('admin/crm-scc380-theme.css');
const manifest=JSON.parse(read('admin/crm-manifest.webmanifest'));
const migration=read('supabase/migrations/20261115010000_crm_activities_makkin_additive.sql');

describe('Bonds CRM combined features from Bonds and Makkin SCC380',()=>{
 test('preserves the established Bonds CRM overview and write entrypoints',()=>{
  for(const action of ['crm-overview','crm-organization-create','crm-opportunity-create',
     'crm-opportunity-update','crm-customer-success-upsert','service-request-status-update'])
   expect(api).toContain("'"+action+"'");
  for(const id of ['kpis','scoringKpis','pipeline','serviceRequestRows','orgRows','renewalRows',
      'successRows','clientRows','orgName','oppTitle','oppOrg','oppStage'])
   expect(html).toContain('id="'+id+'"');
  expect(html).toContain('BondsAuth.authenticatedFetch');
  expect(html).toContain('BondsAdminCommon.escapeHtml');
 });
 test('adds protected Makkin-style contacts, company editing and task workflows',()=>{
  for(const action of ['crm-client-create','crm-client-update','crm-organization-update',
      'crm-activity-create','crm-activity-update','crm-activity-delete']) {
    expect(api).toContain("if (action === '"+action+"')");
    expect(script).toContain("'"+action+"'");
  }
  expect(api).toMatch(/if \(action === 'crm-client-update'\) \{\s*const access = await requireAdminPermission\(req, sb, 'crm.write'\)/);
  expect(api).toContain("requireAdminPermission(req,sb,'crm.write')");
  expect(api).toContain(".from('advisory_clients').update(updates)");
  expect(api).toContain(".from('crm_activities').update(row)");
  expect(script).toContain("window.BondsAuth.authenticatedFetch");
  expect(script).not.toMatch(/localStorage\.(?:setItem|getItem)/);
 });
 test('keeps customer data in server-side Supabase, with a private activities table',()=>{
  expect(migration).toContain('create table if not exists public.crm_activities');
  expect(migration).toContain('alter table public.crm_activities enable row level security');
  expect(migration).toContain('revoke all on table public.crm_activities from PUBLIC, anon, authenticated');
  expect(migration).toContain('grant select, insert, update, delete on table public.crm_activities to service_role');
  expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+public\.crm_/i);
  expect(api).toContain(".is('deleted_at',null)");
 });
 test('offers CRM as installable dedicated PWA, without claiming native EXE',()=>{
  expect(html).toContain('href="/admin/crm-manifest.webmanifest"');
  expect(html).toContain('src="/admin/crm-extended.js?v=1"');
  expect(html).toContain('id="bonds-crm-extensions"');
  expect(manifest.start_url).toBe('/admin/crm.html?source=installed');
  expect(manifest.scope).toBe('/admin/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toContain('CRM');
  expect(script).toContain("'beforeinstallprompt'");
  expect(script).toContain("serviceWorker.register('/sw.js')");
  expect(script).not.toContain("URL.createObjectURL");
  expect(css).toContain('body.crm-scc380 #bonds-crm-extensions');
 });
});
