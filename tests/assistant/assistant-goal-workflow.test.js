/**
 * @jest-environment node
 */

const {
  sanitizeGoalWorkflow,
  ensureSingleEdgeGoalWorkflow,
  createReadWriteGoalWorkflow,
  goalWorkflowGraph,
  nextGoalWorkflowEdge,
  evaluateGoalWorkflowEdge,
  evaluatePlannerGoalEdge,
  grantGoalWorkflowMandate,
  completeGoalWorkflowEdge
} = require('../../lib/assistant/goal-workflow');

describe('assistant goal workflow wave 1', () => {
  test('read edge is executable without a mandate', () => {
    const workflow = ensureSingleEdgeGoalWorkflow(null, {
      action:'project_status',
      effect:'database_read',
      from:'analysis',
      to:'review'
    });
    const edge = nextGoalWorkflowEdge(workflow);

    expect(edge).toMatchObject({
      capability:'project_status',
      effect:'database_read',
      requires_mandate:false,
      status:'pending'
    });
    expect(evaluateGoalWorkflowEdge(edge)).toMatchObject({
      allowed:true,
      code:'GOAL_WORKFLOW_EDGE_READY'
    });
  });

  test('write edge is blocked until the exact capability receives a mandate', () => {
    const workflow = ensureSingleEdgeGoalWorkflow(null, {
      action:'request_create',
      effect:'database_write',
      from:'execution',
      to:'review'
    });
    const edge = nextGoalWorkflowEdge(workflow);

    expect(edge.requires_mandate).toBe(true);
    expect(evaluateGoalWorkflowEdge(edge)).toMatchObject({
      allowed:false,
      code:'GOAL_WORKFLOW_MANDATE_REQUIRED'
    });

    expect(() => grantGoalWorkflowMandate(workflow, {
      edgeId:edge.id,
      capability:'different_capability',
      actionFingerprint:'fp-1'
    })).toThrow('GOAL_WORKFLOW_CAPABILITY_MISMATCH');

    const authorized = grantGoalWorkflowMandate(workflow, {
      edgeId:edge.id,
      capability:'request_create',
      actionFingerprint:'fp-1'
    });
    expect(evaluateGoalWorkflowEdge(nextGoalWorkflowEdge(authorized))).toMatchObject({
      allowed:true,
      code:'GOAL_WORKFLOW_EDGE_READY'
    });
  });

  test('completed edge advances workflow state without inventing new execution', () => {
    const workflow = ensureSingleEdgeGoalWorkflow(null, {
      action:'project_status',
      effect:'database_read',
      from:'analysis',
      to:'review'
    });
    const edge = nextGoalWorkflowEdge(workflow);
    const completed = completeGoalWorkflowEdge(workflow, edge.id);

    expect(completed.edges[0].status).toBe('completed');
    expect(completed.status).toBe('completed');
    expect(completed.current_edge_id).toBeNull();
  });

  test('sanitizer strips executable payloads and bounds the contract', () => {
    const workflow = sanitizeGoalWorkflow({
      status:'active',
      nodes:[
        { id:'analysis', label:'Analysis', status:'active', sql:'drop table x' },
        { id:'review', label:'Review', status:'pending' }
      ],
      edges:[{
        id:'edge:read',
        from:'analysis',
        to:'review',
        capability:'project_status',
        effect:'database_read',
        dependencies:[],
        entry_condition:'registered_capability_available',
        success_condition:'capability_execution_succeeded',
        input:{ sql:'select *' },
        url:'https://evil.example',
        status:'pending'
      }]
    });

    expect(workflow.edges[0].input).toBeUndefined();
    expect(workflow.edges[0].url).toBeUndefined();
    expect(workflow.edges[0]).toMatchObject({
      capability:'project_status',
      effect:'database_read'
    });
  });

  test('read-then-write template uses WorkflowGraph order and blocks the write until mandate', () => {
    const workflow = createReadWriteGoalWorkflow({
      readAction:'project_status',
      writeAction:'request_create',
      readEffect:'database_read',
      writeEffect:'database_write'
    });
    const graph = goalWorkflowGraph(workflow);

    expect(graph.nextStages('gather')).toEqual(['act']);
    expect(graph.nextStages('act')).toEqual(['complete']);
    expect(nextGoalWorkflowEdge(workflow)).toMatchObject({
      capability:'project_status',
      requires_mandate:false
    });

    const afterRead = completeGoalWorkflowEdge(workflow, nextGoalWorkflowEdge(workflow).id);
    const writeEdge = nextGoalWorkflowEdge(afterRead);
    expect(writeEdge).toMatchObject({
      capability:'request_create',
      requires_mandate:true
    });
    expect(evaluatePlannerGoalEdge(afterRead, 'request_create', 'database_write')).toMatchObject({
      allowed:false,
      code:'GOAL_WORKFLOW_MANDATE_REQUIRED'
    });
    expect(evaluatePlannerGoalEdge(afterRead, 'web_search', 'network_read')).toMatchObject({
      allowed:true,
      code:'GOAL_WORKFLOW_READ_UNBOUND'
    });
  });
});
