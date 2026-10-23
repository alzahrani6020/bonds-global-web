/** @jest-environment node */
const fs=require('fs');const path=require('path');
describe('Assistant cost governance',()=>{
 const api=fs.readFileSync(path.join(process.cwd(),'api','admin.js'),'utf8');
 const page=fs.readFileSync(path.join(process.cwd(),'admin','assistant-cost-governance.html'),'utf8');
 const ops=fs.readFileSync(path.join(process.cwd(),'admin','assistant-operations.html'),'utf8');
 test('reuses existing AI operation measurements and read permission',()=>{
   expect(api).toContain(".from('admin_ai_operation_events')");
   expect(api).toContain("requireAdminPermission(req, sb, 'ai.operations.read')");
   expect(api).toContain("'assistant-cost-governance'");
   expect(page).toContain("action=assistant-cost-governance");
 });
 test('is observability only and cannot affect authorization or execution',()=>{
   for(const token of ["observability_only:true","authorization_effect:'none'","execution_blocking:false","token_limiting:false","provider_routing_effect:'none'","model_selection_effect:'none'","compute_limit_effect:'none'"]) expect(api).toContain(token);
   const start=api.indexOf('async function getAssistantCostGovernance');
   const end=api.indexOf('// ── Data Governance / Document Center',start);
   const block=api.slice(start,end);
   expect(block).not.toMatch(/\.(insert|update|upsert|delete)\(/);
   expect(block).not.toContain('requireAdminPermission');
 });
 test('uses bounded time window and existing recorded cost/token/latency fields',()=>{
   expect(api).toContain("Math.min(Number(params.window_days)||30,90)");
   for(const token of ['cost_usd','input_tokens','output_tokens','latency_ms','feature','model']) expect(api).toContain(token);
 });
 test('does not expose user identities in cost output',()=>{
   const start=api.indexOf('async function getAssistantCostGovernance');
   const end=api.indexOf('// ── Data Governance / Document Center',start);
   const block=api.slice(start,end);
   expect(block).not.toContain('user_id');
   expect(page).toContain('منفصل عن authorization');
 });
 test('is linked from Assistant operations',()=>{expect(ops).toContain('/admin/assistant-cost-governance.html');});
});