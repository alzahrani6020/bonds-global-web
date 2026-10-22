/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Assistant audit search',()=>{
  const api=fs.readFileSync(path.join(process.cwd(),'api','admin.js'),'utf8');
  const page=fs.readFileSync(path.join(process.cwd(),'admin','assistant-audit-search.html'),'utf8');
  const operations=fs.readFileSync(path.join(process.cwd(),'admin','assistant-operations.html'),'utf8');
  const platform=fs.readFileSync(path.join(process.cwd(),'admin','platform-center.html'),'utf8');

  test('reuses existing admin plane and ai.operations.read permission',()=>{
    expect(api).toContain("'assistant-audit-search'");
    expect(api).toContain("requireAdminPermission(req, sb, 'ai.operations.read')");
    expect(api).toContain("searchAssistantAudit(sb, req.query || {})");
    expect(page).toContain("/api/admin?");
    expect(page).toContain("action:'assistant-audit-search'");
  });

  test('is bounded and read-only over immutable Assistant audit rows',()=>{
    expect(api).toContain(".from('assistant_action_audit')");
    expect(api).toContain(".select('id,created_at,user_id,boundary,action_id,action_type,target,event_type,outcome,risk,requires_confirmation,resource_id'");
    expect(api).toContain("Math.min(Number(params.limit)||50,100)");
    expect(api).toContain("Math.min(Number(params.offset)||0,10000)");
    expect(api).not.toMatch(/assistant-audit-search[\s\S]{0,1500}\.(insert|update|delete|upsert)\(/);
  });

  test('does not return raw identity session metadata or idempotency material',()=>{
    expect(api).toContain("subject_ref:assistantAuditSubjectRef(row.user_id)");
    expect(api).toContain("raw_user_id:false");
    expect(api).toContain("session_id:false");
    expect(api).toContain("metadata:false");
    expect(api).toContain("idempotency_key_hash:false");
    expect(page).toContain("بدون user_id أو session_id أو metadata أو مفاتيح idempotency");
  });

  test('supports server-side bounded operational filters',()=>{
    for(const token of [
      "action_type","event_type","outcome","risk","requires_confirmation",
      "action_id","resource_id","created_at"
    ]) expect(api).toContain(token);
    expect(api).toContain("throw badRequest('invalid from')");
    expect(api).toContain("throw badRequest('invalid to')");
  });

  test('is linked from existing Assistant operations and platform center',()=>{
    expect(operations).toContain('/admin/assistant-audit-search.html');
    expect(platform).toContain('/admin/assistant-audit-search.html');
  });
});
