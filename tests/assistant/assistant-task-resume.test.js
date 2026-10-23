/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));

const mockRpc = jest.fn();
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc })
}));

const { workflowKeyFor } = require('../../lib/assistant/case-engine');
const { assistantRouter } = require('../../v3/api/assistant');

function getReq(url) {
  return {
    method:'GET',
    url,
    headers:{}
  };
}

function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function callGet(path, url, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(getReq(url), res(resolve), path, user));
}

describe('Assistant Task Resume and guest-to-authenticated continuity', () => {
  beforeEach(() => mockRpc.mockReset());

  test('case workflow identity is deterministic and boundary-scoped', () => {
    const a = workflowKeyFor('page:/services#analysis|service:financial_analysis');
    const b = workflowKeyFor('page:/services#analysis|service:financial_analysis');
    const c = workflowKeyFor('page:/services#risk|service:risk_analysis');
    expect(a).toBe(b);
    expect(a).toMatch(/^assistant-case:[a-f0-9]{32}$/);
    expect(c).not.toBe(a);
  });

  test('resume lookup reads the existing user-scoped workflow without writing', async () => {
    const boundary = 'page:/services#analysis|service:financial_analysis';
    const workflowKey = workflowKeyFor(boundary);
    mockRpc.mockResolvedValueOnce({
      data:{
        id:'wf-1',
        workflow_key:workflowKey,
        boundary,
        status:'active',
        version:4,
        state:{
          boundary,
          goal:'Continue analysis',
          current_stage:'analysis',
          confirmed_facts:{ revenue:1000000 }
        }
      },
      error:null
    });

    const response = await callGet(
      '/assistant/workflows/resume',
      '/api/v3/assistant/workflows/resume?boundary=' + encodeURIComponent(boundary)
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.workflow_key).toBe(workflowKey);
    expect(response.body.workflow.state.current_stage).toBe('analysis');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('assistant_load_workflow_state', {
      p_user_id:'user-1',
      p_workflow_key:workflowKey
    });
  });

  test('resume lookup requires authentication and does not touch persistence', async () => {
    const response = await callGet(
      '/assistant/workflows/resume',
      '/api/v3/assistant/workflows/resume?boundary=page%3A%2Fx%7Cservice%3Anone',
      null
    );
    expect(response.statusCode).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('widget resumes on open and before send, then seeds through governed save path', () => {
    const widget = fs.readFileSync(
      path.join(process.cwd(), 'v3/components/ai-chat-widget.js'),
      'utf8'
    );
    expect(widget).toContain("const ASSISTANT_WORKFLOW_RESUME_URL = '/api/v3/assistant/workflows/resume';");
    expect(widget).toContain("const ASSISTANT_WORKFLOW_SAVE_URL = '/api/v3/assistant/workflows/save';");
    expect(widget).toContain('function mergeGuestStateIntoWorkflow(');
    expect(widget).toContain('async function resumePersistentCaseState()');
    expect(widget.match(/await resumePersistentCaseState\(\);/g)?.length).toBeGreaterThanOrEqual(2);
    expect(widget).toContain('expected_version: workflow.version');
    expect(widget).toContain("status: 'active'");
    expect(widget).toContain('pending_confirmation: null');
  });
});
