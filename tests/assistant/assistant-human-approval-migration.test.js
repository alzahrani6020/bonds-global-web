/** @jest-environment node */
const fs=require('fs'),path=require('path');
describe('Human Approval migration',()=>{
  test('is server-only and excludes support from decision permission',()=>{const s=fs.readFileSync(path.join(__dirname,'..','..','supabase','migrations','20261022193000_assistant_human_approval_queue.sql'),'utf8');expect(s).toContain('assistant_human_approvals');expect(s).toContain("risk IN ('high','critical')");expect(s).toContain("status IN ('pending','approved','rejected','cancelled')");expect(s).toMatch(/REVOKE ALL ON public\.assistant_human_approvals FROM PUBLIC, anon, authenticated, service_role;/);expect(s).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.assistant_human_approvals TO service_role;/);expect(s).toContain("('admin','human_approval.decide')");expect(s).not.toContain("('support','human_approval.decide')");});
});
