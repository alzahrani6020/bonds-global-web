/** @jest-environment node */
const fs=require('fs');const path=require('path');
describe('Assistant per-task budget',()=>{
 const api=fs.readFileSync(path.join(process.cwd(),'api','admin.js'),'utf8');
 const page=fs.readFileSync(path.join(process.cwd(),'admin','assistant-cost-governance.html'),'utf8');
 test('uses existing request_id telemetry and read permission',()=>{
   expect(api).toContain("request_id required");
   expect(api).toContain(".eq('request_id',requestId)");
   expect(api).toContain("'assistant-task-budget'");
   expect(api).toContain("requireAdminPermission(req, sb, 'ai.operations.read')");
   expect(page).toContain("action:'assistant-task-budget'");
 });
 test('is advisory only and cannot limit execution tokens models providers or authorization',()=>{
   for(const token of ["advisory_only:true","enforcement:false","execution_blocking:false","token_limiting:false","model_selection_effect:'none'","provider_routing_effect:'none'","authorization_effect:'none'"])expect(api).toContain(token);
   const start=api.indexOf('async function getAssistantTaskBudget');
   const end=api.indexOf('// ── Data Governance / Document Center',start);
   const block=api.slice(start,end);
   expect(block).not.toMatch(/\.(insert|update|upsert|delete)\(/);
   expect(block).not.toContain('issueToken');
 });
 test('derives state from recorded cost without fabricating unpriced coverage',()=>{
   expect(api).toContain("state:priced.length<events.length?'unpriced':actual>budgetUsd?'over_budget':'within_budget'");
   expect(api).toContain('actual_cost_usd:roundCost(actual)');
   expect(api).toContain('remaining_usd:roundCost(remaining)');
 });
 test('is embedded in cost governance instead of a parallel control center',()=>{
   expect(page).toContain('Per-task Budget — تقييم استرشادي');
   expect(page).toContain('لا تمنع التنفيذ');
   expect(page).toContain('request_id');
 });
});