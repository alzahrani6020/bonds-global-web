/** @jest-environment node */

const {
  SENSITIVE_WORKFLOW_STATES,
  SENSITIVE_WORKFLOW_TRANSITIONS,
  transitionAllowed,
  assertSensitiveTransition,
  transitionSensitiveWorkflowState
}=require('../../lib/assistant/sensitive-workflow-state-machine');

function workflowRow({
  sensitiveState='confirmed',
  status='active',
  version=5
}={}) {
  return {
    id:'row-1',
    workflow_key:'wf-1',
    boundary:'project:p-1',
    status,
    version,
    state:{
      boundary:'project:p-1',
      sensitive_state:sensitiveState,
      goal:'Funding case'
    },
    created_at:'2026-10-22T12:00:00Z',
    updated_at:'2026-10-22T12:01:00Z'
  };
}

describe('sensitive workflow state machine',()=>{
  test('defines the bounded V1 states and recovery graph',()=>{
    expect(SENSITIVE_WORKFLOW_STATES).toEqual([
      'draft','ready','confirmed','submitted','completed','failed'
    ]);
    expect(SENSITIVE_WORKFLOW_TRANSITIONS.submitted).toEqual(['completed','failed']);
    expect(transitionAllowed('failed','ready')).toBe(true);
    expect(transitionAllowed('draft','submitted')).toBe(false);
  });

  test('rejects invalid jumps in the local contract',()=>{
    expect(()=>assertSensitiveTransition('ready','completed'))
      .toThrow('SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED');
  });

  test('calls only the atomic transition RPC with exact user boundary and version',async()=>{
    const rpc=jest.fn().mockResolvedValue({
      data:{
        workflow:workflowRow({ sensitiveState:'confirmed',version:5 }),
        from_state:'ready',
        to_state:'confirmed',
        replayed:false
      },
      error:null
    });
    const out=await transitionSensitiveWorkflowState({
      supabase:{ rpc },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'confirmed',
      expectedVersion:4,
      boundary:'project:p-1',
      reason:'user confirmed'
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'assistant_transition_sensitive_workflow_state',
      expect.objectContaining({
        p_user_id:'user-1',
        p_workflow_key:'wf-1',
        p_to_state:'confirmed',
        p_expected_version:4,
        p_boundary:'project:p-1',
        p_reason:'user confirmed'
      })
    );
    expect(out.transition).toEqual({
      from:'ready',to:'confirmed',replayed:false
    });
    expect(out.execution_triggered).toBe(false);
    expect(out.business_submission_triggered).toBe(false);
    expect(out.authorization.granted).toBe(false);
  });

  test('same-state replay remains read-only and grants no execution',async()=>{
    const rpc=jest.fn().mockResolvedValue({
      data:{
        workflow:workflowRow({ sensitiveState:'ready',version:4 }),
        from_state:'ready',
        to_state:'ready',
        replayed:true
      },
      error:null
    });
    const out=await transitionSensitiveWorkflowState({
      supabase:{ rpc },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'ready',
      expectedVersion:4
    });
    expect(out.transition.replayed).toBe(true);
    expect(out.execution_triggered).toBe(false);
    expect(out.business_submission_triggered).toBe(false);
    expect(out.authorization).toEqual({
      granted:false,
      source:'workflow_state_metadata_only'
    });
  });

  test('maps database governance errors without weakening them',async()=>{
    for(const code of [
      'WORKFLOW_VERSION_CONFLICT',
      'SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT',
      'SENSITIVE_WORKFLOW_STATUS_BLOCKED',
      'WORKFLOW_NOT_FOUND',
      'SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED'
    ]) {
      const rpc=jest.fn().mockResolvedValue({
        data:null,
        error:{ message:`database error: ${code}` }
      });
      await expect(transitionSensitiveWorkflowState({
        supabase:{ rpc },
        userId:'user-1',
        workflowKey:'wf-1',
        toState:'confirmed',
        expectedVersion:4
      })).rejects.toThrow(code);
    }
  });

  test('completed transition returns a closed generic workflow lifecycle',async()=>{
    const rpc=jest.fn().mockResolvedValue({
      data:{
        workflow:workflowRow({
          sensitiveState:'completed',
          status:'completed',
          version:9
        }),
        from_state:'submitted',
        to_state:'completed',
        replayed:false
      },
      error:null
    });
    const out=await transitionSensitiveWorkflowState({
      supabase:{ rpc },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'completed',
      expectedVersion:8
    });
    expect(out.workflow.status).toBe('completed');
    expect(out.workflow.state.sensitive_state).toBe('completed');
  });
});
