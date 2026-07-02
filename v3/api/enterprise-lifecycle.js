/**
 * Enterprise Lifecycle API Router — Phase D.1.5
 *
 * Handles /enterprise-lifecycle/* endpoints.
 */

const { LifecycleEngine } = require('../../lib/enterprise-lifecycle');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function enterpriseLifecycleRouter(req, res, path, supabase, user) {
  const engine = (await new LifecycleEngine({ supabase }).initialize());

  try {
    if (path === '/enterprise-lifecycle/definitions' && req.method === 'GET') {
      const workflows = engine.registry.listWorkflows().map(w => ({
        id: w.id,
        entityType: w.entityType,
        version: w.version,
        name: w.name,
        initialStage: w.initialStage,
        finalStages: w.finalStages,
        stages: w.stages
      }));
      const stages = engine.registry.listStages();
      return sendJson(res, 200, { workflows, stages });
    }

    const definitionMatch = path.match(/^\/enterprise-lifecycle\/definitions\/([^/]+)$/);
    if (definitionMatch && req.method === 'GET') {
      const entityType = definitionMatch[1];
      const workflow = entityType === 'all'
        ? null
        : (engine.registry.getWorkflow(entityType) || engine.registry.findWorkflowForEntityType(entityType));
      if (!workflow) return sendJson(res, 404, { error: 'Workflow definition not found' });
      return sendJson(res, 200, { workflow });
    }

    if (path === '/enterprise-lifecycle/instances' && req.method === 'POST') {
      const body = await parseBody(req);
      const { entityType, entityId, workflowCode, context } = body;
      if (!entityType || !entityId) return sendJson(res, 400, { error: 'entityType and entityId are required' });
      const result = await engine.createInstance({ entityType, entityId, workflowCode, userId: user.id, context });
      return sendJson(res, 201, result);
    }

    const instanceMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)$/);
    if (instanceMatch && req.method === 'GET') {
      const id = instanceMatch[1];
      const state = await engine.getState(id);
      return sendJson(res, 200, state);
    }

    const stateMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/state$/);
    if (stateMatch && req.method === 'GET') {
      const id = stateMatch[1];
      const state = await engine.getState(id);
      return sendJson(res, 200, state);
    }

    const historyMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/history$/);
    if (historyMatch && req.method === 'GET') {
      const id = historyMatch[1];
      const history = await engine.getHistory(id);
      return sendJson(res, 200, { history });
    }

    const timelineMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/timeline$/);
    if (timelineMatch && req.method === 'GET') {
      const id = timelineMatch[1];
      const timeline = await engine.getTimeline(id);
      return sendJson(res, 200, { timeline });
    }

    const tasksMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/tasks$/);
    if (tasksMatch && req.method === 'GET') {
      const id = tasksMatch[1];
      const url = new URL(req.url, `http://${req.headers.host}`);
      const status = url.searchParams.get('status');
      const stageId = url.searchParams.get('stageId');
      const tasks = await engine.getTasks(id, { status, stage_id: stageId });
      return sendJson(res, 200, { tasks });
    }

    const taskCompleteMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/tasks\/([^/]+)\/complete$/);
    if (taskCompleteMatch && req.method === 'POST') {
      const taskId = taskCompleteMatch[2];
      const body = await parseBody(req);
      const { evidence, context } = body;
      const result = await engine.completeTask({
        taskId,
        userId: user.id,
        evidence: evidence || [],
        context: context || {}
      });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    const transitionMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/transition$/);
    if (transitionMatch && req.method === 'POST') {
      const id = transitionMatch[1];
      const body = await parseBody(req);
      const { toStage, reason, context, approvalId } = body;
      if (!toStage) return sendJson(res, 400, { error: 'toStage is required' });
      const result = await engine.transition(id, toStage, { userId: user.id, reason, context, approvalId });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    const validateMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/validate$/);
    if (validateMatch && req.method === 'POST') {
      const id = validateMatch[1];
      const body = await parseBody(req);
      const { toStage, reason, context } = body;
      if (!toStage) return sendJson(res, 400, { error: 'toStage is required' });
      const result = await engine.evaluateTransition(id, toStage, { userId: user.id, reason, context });
      return sendJson(res, 200, result);
    }

    const gateMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/gates\/([^/]+)\/evaluate$/);
    if (gateMatch && req.method === 'POST') {
      const id = gateMatch[1];
      const gateId = gateMatch[2];
      const body = await parseBody(req);
      const result = await engine.evaluateGate(id, gateId, { context: body.context || {} });
      return sendJson(res, 200, { result });
    }

    const approvalsMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/approvals$/);
    if (approvalsMatch && req.method === 'GET') {
      const id = approvalsMatch[1];
      const approvals = await engine.store.listApprovals(id);
      return sendJson(res, 200, { approvals });
    }

    if (approvalsMatch && req.method === 'POST') {
      const id = approvalsMatch[1];
      const body = await parseBody(req);
      const { transitionKey } = body;
      if (!transitionKey) return sendJson(res, 400, { error: 'transitionKey is required' });
      const approval = await engine.requestApproval(id, { transitionKey, requestedBy: user.id });
      return sendJson(res, 201, { approval });
    }

    const approvalDecisionMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/approvals\/([^/]+)\/decision$/);
    if (approvalDecisionMatch && req.method === 'POST') {
      const approvalId = approvalDecisionMatch[2];
      const body = await parseBody(req);
      const { decision, reason, role } = body;
      if (!decision) return sendJson(res, 400, { error: 'decision is required' });
      const result = await engine.submitApproval(approvalId, { userId: user.id, role, decision, reason });
      return sendJson(res, 200, { approval: result });
    }

    const eventsMatch = path.match(/^\/enterprise-lifecycle\/instances\/([^/]+)\/events$/);
    if (eventsMatch && req.method === 'POST') {
      const id = eventsMatch[1];
      const body = await parseBody(req);
      const { eventType, payload } = body;
      if (!eventType) return sendJson(res, 400, { error: 'eventType is required' });
      const event = await engine.emitEvent(id, eventType, payload, body.source || 'api');
      return sendJson(res, 201, { event });
    }

    return sendJson(res, 404, { error: 'Enterprise Lifecycle endpoint not found' });
  } catch (err) {
    console.error('[enterprise-lifecycle]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

module.exports = { enterpriseLifecycleRouter };
