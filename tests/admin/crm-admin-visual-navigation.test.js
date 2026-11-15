/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
describe('Bonds CRM admin and company program visual/navigation acceptance',()=>{
 const admin=read('admin/crm.html');
 const theme=read('admin/crm-scc380-theme.css');
 const customer=read('my-bonds/crm/index.html');
 const layout=read('site-layout.js');
 test('admin dashboard remains separate from customer company application',()=>{
  expect(admin).toContain('href="/my-bonds/crm/"');
  expect(admin).toContain('href="#crm-extensions"');
  expect(read('admin/crm-extended.js')).toContain('id="crm-install"');
  expect(customer).toContain('id="crm-nav"');
  expect(layout).toContain("href: isEn ? '/en/my-bonds/crm/' : '/my-bonds/crm/'");
  expect(layout).toContain("href: '/admin/crm.html'");
 });
 test('admin mirrors Makkin navigation shell and exposes all protected panels',()=>{
  for(const anchor of ['crm-overview','crm-scoring','crm-pipeline','crm-requests','crm-organizations','crm-extensions'])
   expect(admin).toContain('id="'+anchor+'"');
  expect(admin).toContain('class="crm-admin-sidebar"');
  expect(theme).toContain('.crm-admin-sidebar');
  expect(theme).toContain('margin-right:248px');
  expect(theme).toContain('@media(max-width:1000px)');
  expect(admin).toContain('id="bonds-crm-extensions"');
  expect(admin).toContain('id="pipeline" class="pipeline" tabindex="0" role="region"');
 });
 test('confidence summary renders semantic counts, not a raw JSON object in KPI',()=>{
  expect(admin).toContain('function confidenceSummary(value)');
  expect(admin).toContain('confidenceSummary(leadScore.confidence)');
  expect(admin).toContain('confidenceSummary(oppScore.confidence)');
  expect(admin).not.toContain('JSON.stringify(leadScore.confidence||{})');
  expect(admin).not.toContain('JSON.stringify(oppScore.confidence||{})');
 });
});
