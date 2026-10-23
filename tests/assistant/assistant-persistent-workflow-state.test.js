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

  test('load returns null when PostgREST represents an empty composite RPC as an empty array', async () => {
    mockRpc.mockResolvedValueOnce({ data:[], error:null });
    await expect(loadWorkflowState({
      supabase:{ rpc:mockRpc },
      userId:'user-1',
      workflowKey:'wf-404'
    })).resolves.toBeNull();
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
    mockRpc.mockResolvedValueOnce({
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
