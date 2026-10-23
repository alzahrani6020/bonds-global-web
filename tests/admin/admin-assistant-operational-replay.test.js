/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Assistant operational replay',()=>{
  const api=fs.readFileSync(path.join(process.cwd(),'api','admin.js'),'utf8');
  const page=fs.readFileSync(path.join(process.cwd(),'admin','assistant-operational-replay.html'),'utf8');
  const audit=fs.readFileSync(path.join(process.cwd(),'admin','assistant-audit-search.html'),'utf8');
  const operations=fs.readFileSync(path.join(process.cwd(),'admin','assistant-operations.html'),'utf8');

  test('reuses existing admin plane and read permission',()=>{
    expect(api).toContain("'assistant-operational-replay'");
    expect(api).toContain("requireAdminPermission(req, sb, 'ai.operations.read')");
    expect(api).toContain("getAssistantOperationalReplay(sb, req.query || {})");
    expect(page).toContain("action:'assistant-operational-replay'");
  });

  test('requires exact identifiers and reconstructs immutable audit evidence only',()=>{
    expect(api).toContain("action_id or resource_id required");
    expect(api).toContain(".from('assistant_action_audit')");
    expect(api).toContain(".order('created_at',{ascending:true})");
    expect(api).toContain(".limit(200)");
    expect(api).toContain("execution_performed:false");
    expect(api).toContain("writes_performed:false");
    expect(api).toContain("authorization_simulated:false");
  });

  test('contains no execution or write path in replay handler',()=>{
    const start=api.indexOf('async function getAssistantOperationalReplay');
    const end=api.indexOf('// ── Data Governance / Document Center',start);
    const block=api.slice(start,end);
    expect(block).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(block).not.toContain('executeStructuredAction');
    expect(block).not.toContain('serviceToken');
    expect(block).not.toContain('issueToken');
    expect(block).not.toContain('capabilities.js');
  });

  test('does not expose raw user identity or metadata',()=>{
    const start=api.indexOf('async function getAssistantOperationalReplay');
    const end=api.indexOf('// ── Data Governance / Document Center',start);
    const block=api.slice(start,end);
    expect(block).toContain('subject_ref:subjectRefs[0]||null');
    expect(block).not.toContain('session_id:');
    expect(block).not.toContain('metadata:');
    expect(block).not.toContain('idempotency_key_hash:');
    expect(page).toContain('بدون إعادة تنفيذ أي capability أو write');
  });

  test('is linked from audit search and Assistant operations',()=>{
    expect(audit).toContain('/admin/assistant-operational-replay.html');
    expect(operations).toContain('/admin/assistant-operational-replay.html');
  });
});
