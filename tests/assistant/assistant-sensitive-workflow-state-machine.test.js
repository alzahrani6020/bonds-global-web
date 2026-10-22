/** @jest-environment node */

const mockLoadWorkflowState=jest.fn();
const mockSaveWorkflowState=jest.fn();

jest.mock('../../lib/assistant/workflow-state', () => ({
  loadWorkflowState:(args)=>mockLoadWorkflowState(args),
  saveWorkflowState:(args)=>mockSaveWorkflowState(args)
}));

const {
  SENSITIVE_WORKFLOW_STATES,
  SENSITIVE_WORKFLOW_TRANSITIONS,
  transitionAllowed,
  assertSensitiveTransition,
  transitionSensitiveWorkflowState
}=require('../../lib/assistant/sensitive-workflow-state-machine');

describe('sensitive workflow state machine',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockLoadWorkflowState.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:4,
      state:{
        boundary:'project:p-1',
        sensitive_state:'ready',
        goal:'Funding case'
      }
    });
    mockSaveWorkflowState.mockImplementation(async args=>({
      workflow_key:args.workflowKey,
      boundary:args.boundary,
      status:args.status,
      version:args.expectedVersion+1,
      state:args.state
    }));
  });

  test('defines the bounded V1 states and recovery graph',()=>{
    expect(SENSITIVE_WORKFLOW_STATES).toEqual([
      'draft','ready','confirmed','submitted','completed','failed'
    ]);
    expect(SENSITIVE_WORKFLOW_TRANSITIONS.submitted).toEqual(['completed','failed']);
    expect(transitionAllowed('failed','ready')).toBe(true);
    expect(transitionAllowed('draft','submitted')).toBe(false);
  });

  test('rejects invalid jumps before persistence',()=>{
    expect(()=>assertSensitiveTransition('ready','completed'))
      .toThrow('SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED');
  });

  test('requires exact workflow ownership, boundary and optimistic version',async()=>{
    await transitionSensitiveWorkflowState({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'confirmed',
      expectedVersion:4,
      boundary:'project:p-1',
      reason:'user confirmed'
    });

    expect(mockLoadWorkflowState).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      workflowKey:'wf-1'
    }));
    expect(mockSaveWorkflowState).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:4,
      state:expect.objectContaining({
        sensitive_state:'confirmed',
        last_action:expect.objectContaining({
          type:'sensitive_workflow_transition',
          from_state:'ready',
          to_state:'confirmed'
        })
      })
    }));
  });

  test('same-state replay does not write or execute',async()=>{
    const out=await transitionSensitiveWorkflowState({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'ready',
      expectedVersion:4
    });
    expect(out.transition.replayed).toBe(true);
    expect(mockSaveWorkflowState).not.toHaveBeenCalled();
    expect(out.execution_triggered).toBe(false);
    expect(out.business_submission_triggered).toBe(false);
    expect(out.authorization.granted).toBe(false);
  });

  test('rejects boundary mismatch and terminal workflow status',async()=>{
    await expect(transitionSensitiveWorkflowState({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'confirmed',
      expectedVersion:4,
      boundary:'project:p-2'
    })).rejects.toThrow('SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT');

    mockLoadWorkflowState.mockResolvedValueOnce({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'completed',
      version:4,
      state:{ boundary:'project:p-1', sensitive_state:'submitted' }
    });
    await expect(transitionSensitiveWorkflowState({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'completed',
      expectedVersion:4
    })).rejects.toThrow('SENSITIVE_WORKFLOW_STATUS_BLOCKED');
  });

  test('state transition metadata never grants business execution',async()=>{
    const out=await transitionSensitiveWorkflowState({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'confirmed',
      expectedVersion:4
    });
    expect(out.execution_triggered).toBe(false);
    expect(out.business_submission_triggered).toBe(false);
    expect(out.authorization).toEqual({
      granted:false,
      source:'workflow_state_metadata_only'
    });
  });
});
