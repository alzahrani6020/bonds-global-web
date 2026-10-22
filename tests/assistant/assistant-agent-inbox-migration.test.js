/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Agent Inbox migration security',()=>{
  test('queue is server-only with RLS and no browser grants',()=>{
    const source=fs.readFileSync(
      path.join(__dirname,'..','..','supabase','migrations','20261022180500_assistant_agent_inbox.sql'),
      'utf8'
    );
    expect(source).toContain('ALTER TABLE public.assistant_agent_inbox ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('REVOKE ALL ON public.assistant_agent_inbox FROM PUBLIC, anon, authenticated, service_role');
    expect(source).toContain('GRANT SELECT, INSERT, UPDATE ON public.assistant_agent_inbox TO service_role');
    expect(source).not.toMatch(/GRANT\s+.*TO\s+(anon|authenticated)/i);
    expect(source).not.toMatch(/CREATE\s+POLICY/i);
  });
});
