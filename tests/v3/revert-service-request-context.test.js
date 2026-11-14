/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('user-directed removal of unused service request atomic context additions',()=>{
 const api=read('v3/api/services.js');
 const ui=read('components/service-request.js');
 const sql=read('supabase/migrations/20261114053000_revert_service_request_atomic_context.sql');

 test('requests use the previous insert path without the retired RPC or typed links',()=>{
  expect(api).not.toContain(".rpc('create_service_request_atomic'");
  expect(api).toContain(".from('service_requests')\n    .insert(requestRow)");
  expect(api).toContain(".from('service_request_values').insert(valueRows)");
  expect(api).not.toContain("SERVICE_REQUEST_CONTEXT_NOT_OWNED");
  expect(api).not.toContain("project_id:verifiedContext?.projectId");
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
   expect(read(file)).toContain('/components/service-request.js?v=24');
  }
  expect(read('sw.js')).toMatch(/const CACHE_VERSION = 'v3\\.0\\.\\d+';/);
 });
});
