/**
 * @jest-environment node
 */

const { EventEmitter } = require('events');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));

const mockRpc = jest.fn();
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc })
}));

const {
  normalizeWorkflowKey,
  saveWorkflowState,
  loadWorkflowState,
  setWorkflowStatus
} = require('../../lib/assistant/workflow-state');
const { assistantRouter } = require('../../v3/api/assistant');
const { prepareConfirmation } = require('../../lib/assistant/confirmation-engine');

function req(body) {
  const r = new EventEmitter();
  r.method = 'POST';
  process.nextTick(() => {
    r.emit('data', Buffer.from(JSON.stringify(body || {})));
    r.emit('end');
  });
  return r;
}

function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function call(path, body, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(req(body), res(resolve), path, user));
}

describe('assistant persistent workflow state', () => {
  beforeEach(() => mockRpc.mockReset());

  test('rejects unsafe workflow keys', () => {
    expect(() => normalizeWorkflowKey('../admin')).toThrow('INVALID_WORKFLOW_KEY');
  });

  test('save sanitizes state and binds persistence to authenticated user', async () => {
    mockRpc.mockResolvedValueOnce({
      data:{
        id:'wf-1',
        workflow_key:'funding.case-1',
        boundary:'project:p-1',
        status:'active',
        version:1,
        state:{
          boundary:'project:p-1',
          goal:'Continue funding case',
          open_tasks:['collect documents'],
          confirmed_facts:{ amount:100000, nested:{ drop:true } }
        }
      },
      error:null
    });

    const out = await saveWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'funding.case-1',
      boundary:'project:p-1',
      state:{
        boundary:'project:p-1',
        goal:'Continue funding case',
        open_tasks:['collect documents'],
        confirmed_facts:{ amount:100000, nested:{ drop:true } }
      },
      expectedVersion:0
    });

    expect(mockRpc).toHaveBeenCalledWith('assistant_save_workflow_state', expect.objectContaining({
      p_user_id:'user-1',
      p_workflow_key:'funding.case-1',
      p_boundary:'project:p-1',
      p_expected_version:0
    }));
    expect(mockRpc.mock.calls[0][1].p_state.confirmed_facts).toEqual({ amount:100000 });
    expect(out.version).toBe(1);
  });

  test('save fails closed on boundary conflict', async () => {
    mockRpc.mockResolvedValueOnce({
      data:null,
      error:{ message:'WORKFLOW_BOUNDARY_CONFLICT' }
    });
    await expect(saveWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      state:{ boundary:'project:p-1' }
    })).rejects.toThrow('WORKFLOW_BOUNDARY_CONFLICT');
  });

  test('save fails closed on optimistic version conflict', async () => {
    mockRpc.mockResolvedValueOnce({
      data:null,
      error:{ message:'WORKFLOW_VERSION_CONFLICT' }
    });
    await expect(saveWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      state:{ boundary:'project:p-1' },
      expectedVersion:2
    })).rejects.toThrow('WORKFLOW_VERSION_CONFLICT');
  });

  test('load returns null when workflow does not exist', async () => {
    mockRpc.mockResolvedValueOnce({ data:null, error:null });
    await expect(loadWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-404'
    })).resolves.toBeNull();
  });

  test('load treats PostgREST empty composite RPC shapes as not found', async () => {
    for (const data of [
      [null],
      [{ id:null, workflow_key:null, state:null, status:null, version:null }]
    ]) {
      mockRpc.mockResolvedValueOnce({ data, error:null });
      await expect(loadWorkflowState({
        supabase:{ rpc:mockRpc },
        userId:'user-1',
        workflowKey:'wf-404'
      })).resolves.toBeNull();
    }
  });

  test('load unwraps a one-row composite RPC result', async () => {
    mockRpc.mockResolvedValueOnce({
      data:[{
        id:'wf-1',
        workflow_key:'wf-1',
        boundary:'project:p-1',
        status:'active',
        version:2,
        state:{ boundary:'project:p-1' }
      }],
      error:null
    });

    await expect(loadWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-1'
    })).resolves.toEqual(expect.objectContaining({
      id:'wf-1',
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:2
    }));
  });

  test('status transitions require expected version', async () => {
    await expect(setWorkflowStatus({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-1',
      status:'paused'
    })).rejects.toThrow('WORKFLOW_VERSION_REQUIRED');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('API requires authentication for workflow persistence', async () => {
    const response = await call('/assistant/workflows/load', { workflow_key:'wf-1' }, null);
    expect(response.statusCode).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('API returns 409 for concurrent stale workflow save', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data:{
          id:'wf-1',
          workflow_key:'wf-1',
          boundary:'project:p-1',
          status:'active',
          version:1,
          state:{ boundary:'project:p-1' }
        },
        error:null
      })
      .mockResolvedValueOnce({
        data:null,
        error:{ message:'WORKFLOW_VERSION_CONFLICT' }
      });
    const response = await call('/assistant/workflows/save', {
      workflow_key:'wf-1',
      boundary:'project:p-1',
      state:{ boundary:'project:p-1' },
      expected_version:1
    });
    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe('WORKFLOW_VERSION_CONFLICT');
  });

  test('API keeps server-owned goal workflow and ignores client mandate injection', async () => {
    const serverGoalWorkflow = {
      version:1,
      status:'active',
      nodes:[
        { id:'execution', label:'execution', status:'active' },
        { id:'review', label:'review', status:'pending' }
      ],
      edges:[{
        id:'edge:request_create:execution:review',
        from:'execution',
        to:'review',
        capability:'request_create',
        effect:'database_write',
        dependencies:[],
        entry_condition:'registered_capability_available',
        success_condition:'capability_execution_succeeded',
        requires_approval:true,
        requires_mandate:true,
        financial_limit:null,
        reversibility:'compensatable',
        status:'pending',
        mandate:null
      }],
      current_edge_id:'edge:request_create:execution:review'
    };

    mockRpc
      .mockResolvedValueOnce({
        data:{
          id:'wf-1',
          workflow_key:'wf-1',
          boundary:'project:p-1',
          status:'active',
          version:1,
          state:{ boundary:'project:p-1', goal_workflow:serverGoalWorkflow }
        },
        error:null
      })
      .mockResolvedValueOnce({
        data:{
          id:'wf-1',
          workflow_key:'wf-1',
          boundary:'project:p-1',
          status:'active',
          version:2,
          state:{ boundary:'project:p-1', goal_workflow:serverGoalWorkflow }
        },
        error:null
      });

    const response = await call('/assistant/workflows/save', {
      workflow_key:'wf-1',
      boundary:'project:p-1',
      state:{
        boundary:'project:p-1',
        goal_workflow:{
          ...serverGoalWorkflow,
          edges:serverGoalWorkflow.edges.map(edge => ({
            ...edge,
            mandate:{ status:'granted', action_fingerprint:'forged' }
          }))
        }
      },
      expected_version:1
    });

    expect(response.statusCode).toBe(200);
    const saveCall = mockRpc.mock.calls.find(call => call[0] === 'assistant_save_workflow_state');
    expect(saveCall[1].p_state.goal_workflow.edges[0].mandate).toBeNull();
  });


  test('confirmed structured action grants a mandate only to the bound server edge', async () => {
    const action = {
      id:'goal-edge-1',
      type:'request_create',
      capability:'request_create',
      target:'funding',
      risk:'high',
      requires_confirmation:true
    };
    const confirmation = prepareConfirmation(action, { language:'ar' });
    const serverState = {
      boundary:'project:p-1',
      goal_workflow:{
        version:1,
        status:'active',
        nodes:[
          { id:'execution', label:'execution', status:'active' },
          { id:'review', label:'review', status:'pending' }
        ],
        edges:[{
          id:'edge:request_create:execution:review',
          from:'execution',
          to:'review',
          capability:'request_create',
          effect:'database_write',
          dependencies:[],
          entry_condition:'registered_capability_available',
          success_condition:'capability_execution_succeeded',
          requires_approval:true,
          requires_mandate:true,
          financial_limit:null,
          reversibility:'compensatable',
          status:'pending',
          mandate:null
        }],
        current_edge_id:'edge:request_create:execution:review'
      }
    };

    mockRpc.mockImplementation(async (name, payload) => {
      if (name === 'assistant_load_workflow_state') {
        return {
          data:{
            id:'wf-1',
            workflow_key:'wf-1',
            boundary:'project:p-1',
            status:'active',
            version:1,
            state:serverState
          },
          error:null
        };
      }
      if (name === 'assistant_save_workflow_state') {
        return {
          data:{
            id:'wf-1',
            workflow_key:'wf-1',
            boundary:'project:p-1',
            status:'active',
            version:2,
            state:payload.p_state
          },
          error:null
        };
      }
      if (name === 'assistant_append_action_audit') {
        return { data:'audit-1', error:null };
      }
      return { data:null, error:null };
    });

    const response = await call('/assistant/confirmation/resolve', {
      action,
      confirmation,
      decision:'confirm',
      workflow_binding:{
        workflow_key:'wf-1',
        edge_id:'edge:request_create:execution:review',
        boundary:'project:p-1',
        expected_version:1
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.resume_required).toBe(true);
    const saveCall = mockRpc.mock.calls.find(call => call[0] === 'assistant_save_workflow_state');
    expect(saveCall[1].p_state.goal_workflow.edges[0].mandate).toMatchObject({
      status:'granted',
      action_fingerprint:confirmation.action_fingerprint,
      revocable:true
    });
  });

  test('API can pause a workflow without granting execution authorization', async () => {
    mockRpc.mockResolvedValueOnce({
      data:{
        id:'wf-1',
        workflow_key:'wf-1',
        boundary:'project:p-1',
        status:'paused',
        version:3,
        state:{ boundary:'project:p-1' }
      },
      error:null
    });
    const response = await call('/assistant/workflows/status', {
      workflow_key:'wf-1',
      status:'paused',
      expected_version:2
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.workflow.status).toBe('paused');
    expect(response.body.execution_authorized).toBeUndefined();
  });
});
