/** @jest-environment node */
const fs=require('fs'),path=require('path');
describe('Human Approval migration',()=>{
  test('extends existing approval control plane instead of creating a parallel queue',()=>{
    const s=fs.readFileSync(path.join(__dirname,'..','..','supabase','migrations','20261022193000_assistant_human_approval_queue.sql'),'utf8');
    expect(s).toContain('ALTER TABLE public.admin_approval_requests');
    expect(s).not.toContain('CREATE TABLE IF NOT EXISTS public.assistant_human_approvals');
    expect(s).toContain("risk IS NULL OR risk IN ('high','critical')");
    expect(s).toContain("('assistant.human_approval','Assistant sensitive action approval request','critical')");
    expect(s).toContain("('admin','human_approval.decide')");
    expect(s).not.toContain("('support','human_approval.decide')");
    expect(s).toMatch(/REVOKE ALL ON public\.admin_approval_requests FROM PUBLIC, anon, authenticated;/);
    expect(s).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.admin_approval_requests TO service_role;/);
  });
});
