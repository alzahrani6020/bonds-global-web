/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('service request atomic ownership contracts',()=>{
 const api=read('v3/api/services.js');
 const ui=read('components/service-request.js');
 const sql=read('supabase/migrations/20261113195100_service_request_atomic_context.sql');
 const handler=api.slice(api.indexOf('async function handleServiceRequests('),api.indexOf('function defaultRequestProfileForService('));
 test('no individual request or values inserts survive API changes',()=>{
  expect(handler).toContain(".rpc('create_service_request_atomic'");
  expect(handler).not.toContain(".from('service_requests')\n    .insert(requestRow)");
  expect(handler).not.toContain(".from('service_request_values').insert(valueRows)");
  expect(sql).toContain('INSERT INTO public.service_requests');
  expect(sql).toContain('INSERT INTO public.service_request_values');
  expect(sql).toContain('SECURITY INVOKER');
  expect(sql).toContain('REVOKE ALL ON FUNCTION public.create_service_request_atomic');
  expect(sql).toContain('TO service_role');
 });
 test('owner-checked identifiers are saved in actual foreign key columns',()=>{
  expect(handler).toContain('await assertContextOwnership(supabase,user,contextIds)');
  expect(handler).toContain('project_id:verifiedContext?.projectId || null');
  expect(handler).toContain('deal_id:verifiedContext?.dealId || null');
  expect(handler).toContain('opportunity_id:verifiedContext?.opportunityId || null');
  expect(sql).toContain('REFERENCES public.bonds_projects(id)');
  expect(sql).toContain('REFERENCES public.bonds_deals(id)');
  expect(sql).toContain('REFERENCES public.bonds_investment_opportunities(id)');
 });
 test('shared-browser drafts are never read or written before authenticated identity',()=>{
  expect(ui).toContain('let workspaceDraftKey=null');
  expect(ui).toContain("bonds_service_workspace_draft_v3:'+draftOwner");
  expect(ui).toContain('if(!isServiceWorkspace||!workspaceDraftKey)return');
  expect(ui).not.toContain('bonds_service_workspace_draft_v2:');
 });
});
