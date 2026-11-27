/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('service request rollback history and transactional tenant-isolation regression',()=>{
 const api=read('v3/api/services.js');
 const ui=read('components/service-request.js');
 const sql=read('supabase/migrations/20261114053000_revert_service_request_atomic_context.sql');

 test('service requests are atomic and tenant-scoped without reintroducing unverified context links',()=>{
  const atomic=read('supabase/migrations/20261125013416_service_request_workspace_project_atomic.sql');
  const guard=read('supabase/migrations/20261125013637_enforce_service_request_workspace_project_tenant_links.sql');
  expect(api).toContain(".rpc('create_service_request_atomic'");
  expect(api).toContain('resolveServiceRequestWorkspace(supabase,user,companyId)');
  expect(api).toContain('REQUEST_COMMIT_UNVERIFIED');
  expect(api).not.toContain(".from('service_request_values').insert(valueRows)");
  expect(atomic).toMatch(/insert into public\.service_requests\(/i);
  expect(atomic).toMatch(/insert into public\.service_request_values\(/i);
  expect(atomic).toContain("'WORKSPACE_ACCESS_DENIED'");
  expect(atomic).toContain("'PROJECT_ACCESS_DENIED'");
  expect(atomic).toContain('revoke all on function public.create_service_request_atomic');
  expect(atomic).toContain('grant execute on function public.create_service_request_atomic');
  expect(atomic).not.toMatch(/security\s+definer/i);
  expect(guard).toContain('service_request_links_guard');
  expect(guard).toContain("'WORKSPACE_ACCESS_DENIED'");
  expect(guard).toContain("'PROJECT_ACCESS_DENIED'");
 });

 test('workspace draft uses the prior implementation',()=>{
  expect(ui).not.toContain('bonds_service_workspace_draft_v3:');
  expect(ui).toContain("const workspaceDraftKey='bonds_service_workspace_draft_v2:'");
 });

 test('rollback is conditional and does not remove request rows',()=>{
  expect(sql).toContain('SERVICE_CONTEXT_LINKS_NOT_EMPTY');
  expect(sql).toContain('DROP FUNCTION IF EXISTS public.create_service_request_atomic');
  expect(sql).toContain('DROP COLUMN IF EXISTS project_id RESTRICT');
  expect(sql).toContain('DROP COLUMN IF EXISTS deal_id RESTRICT');
  expect(sql).toContain('DROP COLUMN IF EXISTS opportunity_id RESTRICT');
  expect(sql).not.toMatch(/\b(?:DELETE FROM|TRUNCATE|DROP TABLE|CASCADE)\b/i);
 });

 test('cache-busting is consistent in all service request entry pages',()=>{
  for(const file of ['service-request.html','en/service-request.html','my-bonds/workspace/index.html','en/my-bonds/workspace/index.html']){
   expect(read(file)).toContain('/components/service-request.js?v=52');
  }
  // The assistant runtime changed in this candidate and requires a cache bump.
  expect(read('sw.js')).toContain("const CACHE_VERSION = 'v3.0.352';");
 });
});
