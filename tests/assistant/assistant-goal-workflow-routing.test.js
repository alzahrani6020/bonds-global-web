/**
 * @jest-environment node
 */

const mockExecuteService = jest.fn();
const mockLoadExecutionProfile = jest.fn();
jest.mock('../../lib/services/service-execution-router', () => ({
  executeService:mockExecuteService,
  loadExecutionProfile:mockLoadExecutionProfile
}));

const mockPersistCaseState = jest.fn();
jest.mock('../../lib/assistant/case-engine', () => {
  const actual = jest.requireActual('../../lib/assistant/case-engine');
  return {
    ...actual,
    workflowKeyFor: () => 'assistant-case:test',
    persistCaseState:mockPersistCaseState
  };
});

const mockGetCapability = jest.fn();
jest.mock('../../lib/capabilities/bonds-capability-registry', () => ({
  getCapability:mockGetCapability
}));

const { ensureSingleEdgeGoalWorkflow } = require('../../lib/assistant/goal-workflow');
const { orchestrateChat } = require('../../lib/assistant/chat-orchestrator');

function fakeSupabase() {
  return {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        or() { return query; },
        limit() { return query; },
        order() {
          return Promise.resolve({ data:[], error:null });
        },
        maybeSingle() {
          if (table === 'profiles') {
            return Promise.resolve({ data:{ id:'u1', role:'client', status:'active' }, error:null });
          }
          if (table === 'service_catalog') {
            return Promise.resolve({
              data:{
                id:'svc-1',
                code:'funding',
                name_ar:'التمويل',
                name_en:'Funding',
                status:'published',
                is_active:true
              },
              error:null
            });
          }
          return Promise.resolve({ data:null, error:null });
        }
      };
      return query;
    }
  };
}

function persistedFor(action, effect, stage = 'analysis') {
  return {
    version:1,
    state:{
      boundary:'page:/funding|service:funding',
      current_stage:stage,
      goal_workflow:ensureSingleEdgeGoalWorkflow(null, {
        action,
        effect,
        from:stage,
        to:'review'
      })
    }
  };
}

describe('chat orchestrator goal workflow execution gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('read edge reaches the existing governed service execution path', async () => {
    mockLoadExecutionProfile.mockResolvedValue({
      profile:{
        execution_mode:'capability_plan',
        primary_action:'project_status'
      }
    });
    mockGetCapability.mockReturnValue({ sideEffect:'database_read' });
    mockPersistCaseState.mockResolvedValue(persistedFor('project_status', 'database_read'));
    mockExecuteService.mockResolvedValue({
      body:{
        ok:true,
        executed:true,
        capability:'project_status',
        result:{ status:'active' }
      }
    });

    const result = await orchestrateChat({
      req:{ headers:{} },
      user:{ id:'u1' },
      supabase:fakeSupabase(),
      message:'حلل حالة المشروع',
      context:{ pagePath:'/funding', serviceCode:'funding', executionInputs:{ project_id:'p1' } },
      assistantState:{ confirmed_facts:{} },
      messages:[]
    });

    expect(mockExecuteService).toHaveBeenCalledTimes(1);
    expect(result.handled).toBe(true);
    expect(result.response.execution.executed).toBe(true);
  });

  test('write edge without server mandate stops before service execution', async () => {
    mockLoadExecutionProfile.mockResolvedValue({
      profile:{
        execution_mode:'capability_plan',
        primary_action:'request_create'
      }
    });
    mockGetCapability.mockReturnValue({ sideEffect:'database_write' });
    mockPersistCaseState.mockResolvedValue(persistedFor('request_create', 'database_write', 'execution'));

    const result = await orchestrateChat({
      req:{ headers:{} },
      user:{ id:'u1' },
      supabase:fakeSupabase(),
      message:'نفذ الطلب',
      context:{ pagePath:'/funding', serviceCode:'funding', executionInputs:{ amount:1000 } },
      assistantState:{ confirmed_facts:{} },
      messages:[]
    });

    expect(mockExecuteService).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.response.error.code).toBe('GOAL_WORKFLOW_MANDATE_REQUIRED');
    expect(result.response.actions[0]).toMatchObject({
      type:'request_create',
      capability:'request_create',
      requires_confirmation:true
    });
    expect(result.response.actions[0].workflow_binding).toMatchObject({
      workflow_key:'assistant-case:test'
    });
  });
});
