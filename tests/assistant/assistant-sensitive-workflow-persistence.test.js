/** @jest-environment node */

const fs=require('fs');
const path=require('path');
const { saveWorkflowState }=require('../../lib/assistant/workflow-state');

describe('sensitive workflow persistence hardening',()=>{
  test('general workflow persistence strips sensitive_state before calling the database',async()=>{
    const rpc=jest.fn().mockResolvedValue({
      data:{
        id:'wf-row',
        workflow_key:'wf-1',
        boundary:'project:p-1',
        status:'active',
        version:5,
        state:{
          boundary:'project:p-1',
          goal:'Updated',
          sensitive_state:'confirmed'
        }
      },
      error:null
    });

    await saveWorkflowState({
      supabase:{ rpc },
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:4,
      state:{
        boundary:'project:p-1',
        goal:'Updated',
        sensitive_state:'completed'
      }
    });

    const args=rpc.mock.calls[0][1];
    expect(args.p_state.goal).toBe('Updated');
    expect(args.p_state).not.toHaveProperty('sensitive_state');
  });

  test('migration preserves governed state and exposes only the atomic transition RPC to service role',()=>{
    const source=fs.readFileSync(
      path.join(
        __dirname,'..','..','supabase','migrations',
        '20261022180000_assistant_sensitive_workflow_state_machine.sql'
      ),
      'utf8'
    );

    expect(source).toContain("p_state - 'sensitive_state'");
    expect(source).toContain("v_row.state -> 'sensitive_state'");
    expect(source).toContain('assistant_transition_sensitive_workflow_state');
    expect(source).toContain('FOR UPDATE');
    expect(source).toContain('WORKFLOW_VERSION_CONFLICT');
    expect(source).toContain('SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT');
    expect(source).toContain('SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED');
    expect(source).toContain("WHEN p_to_state = 'completed' THEN 'completed'");
    expect(source).toMatch(/REVOKE ALL ON FUNCTION public\.assistant_transition_sensitive_workflow_state[\s\S]*FROM PUBLIC, anon, authenticated;/);
    expect(source).toMatch(/GRANT EXECUTE ON FUNCTION public\.assistant_transition_sensitive_workflow_state[\s\S]*TO service_role;/);
    expect(source).not.toMatch(/GRANT\s+EXECUTE[\s\S]{0,180}TO\s+(anon|authenticated)/i);
  });
});
