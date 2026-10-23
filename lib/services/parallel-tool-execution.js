'use strict';

const { getCapability } = require('../capabilities/bonds-capability-registry');
const {
  executeService,
  loadExecutionProfile
} = require('./service-execution-router');

const PARALLEL_TOOL_EXECUTION_VERSION = 1;
const MAX_PARALLEL_TASKS = 8;
const SAFE_PARALLEL_SIDE_EFFECTS = Object.freeze([
  'none',
  'database_read',
  'network_read',
  'compute'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function normalizeParallelRequests(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('PARALLEL_REQUESTS_REQUIRED');
  }
  if (requests.length > MAX_PARALLEL_TASKS) {
    throw new Error('PARALLEL_REQUEST_LIMIT_EXCEEDED');
  }

  const normalized = requests.map((request, index) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('INVALID_PARALLEL_REQUEST');
    }
    if (request.independent !== true) {
      throw new Error('PARALLEL_TASK_NOT_DECLARED_INDEPENDENT');
    }

    const serviceCode = String(request.service_code || '').trim();
    if (!serviceCode) throw new Error('PARALLEL_SERVICE_CODE_REQUIRED');

    return {
      id: String(request.id || `parallel-${String(index + 1).padStart(3, '0')}`),
      service_code: serviceCode,
      independent: true,
      body: asObject(request.body)
    };
  });

  const ids = normalized.map(item => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('PARALLEL_TASK_ID_DUPLICATE');
  }

  return normalized;
}

async function preflightParallelServices({
  requests,
  supabase,
  loadProfileFn = loadExecutionProfile,
  getCapabilityFn = getCapability
}) {
  const tasks = normalizeParallelRequests(requests);

  const resolved = await Promise.all(
    tasks.map(async task => ({
      task,
      execution: await loadProfileFn(supabase, task.service_code)
    }))
  );

  return resolved.map(({ task, execution }) => {
    if (!execution) {
      const error = new Error('PARALLEL_SERVICE_NOT_FOUND');
      error.taskId = task.id;
      throw error;
    }

    const profile = execution.profile || {};
    if (profile.execution_mode !== 'capability_plan' || !profile.primary_action) {
      const error = new Error('PARALLEL_SERVICE_NOT_AUTOMATED');
      error.taskId = task.id;
      throw error;
    }

    const capability = getCapabilityFn(profile.primary_action);
    if (!capability || capability.active === false) {
      const error = new Error('PARALLEL_CAPABILITY_UNAVAILABLE');
      error.taskId = task.id;
      throw error;
    }

    if (!SAFE_PARALLEL_SIDE_EFFECTS.includes(capability.sideEffect)) {
      const error = new Error('PARALLEL_SIDE_EFFECT_NOT_SAFE');
      error.taskId = task.id;
      error.sideEffect = capability.sideEffect || null;
      throw error;
    }

    return {
      ...task,
      primary_action: profile.primary_action,
      side_effect: capability.sideEffect
    };
  });
}

function parallelRequestContext(req, taskId) {
  const headers = {
    ...asObject(req?.headers)
  };
  delete headers['x-bonds-service-token'];
  delete headers['X-Bonds-Service-Token'];

  const parentRequestId = headers['x-request-id'] || null;
  if (parentRequestId) {
    headers['x-request-id'] = `${parentRequestId}:${taskId}`;
  }

  return {
    ...req,
    headers
  };
}

async function executeParallelServices({
  req,
  user,
  supabase,
  requests,
  loadProfileFn = loadExecutionProfile,
  getCapabilityFn = getCapability,
  executeServiceFn = executeService
}) {
  const plan = await preflightParallelServices({
    requests,
    supabase,
    loadProfileFn,
    getCapabilityFn
  });

  const startedAt = Date.now();

  const results = await Promise.all(
    plan.map(async task => {
      try {
        const result = await executeServiceFn({
          req: parallelRequestContext(req, task.id),
          user,
          supabase,
          serviceCode: task.service_code,
          body: {
            ...task.body,
            source: task.body.source || 'assistant_parallel_tool_execution'
          }
        });

        return {
          id: task.id,
          service_code: task.service_code,
          primary_action: task.primary_action,
          side_effect: task.side_effect,
          ok: Boolean(result?.body?.ok),
          executed: Boolean(result?.body?.executed),
          http_status: result?.httpStatus || null,
          result: result?.body || null
        };
      } catch (error) {
        return {
          id: task.id,
          service_code: task.service_code,
          primary_action: task.primary_action,
          side_effect: task.side_effect,
          ok: false,
          executed: false,
          http_status: 503,
          result: {
            ok: false,
            executed: false,
            error: {
              code: 'PARALLEL_TASK_EXECUTION_FAILED',
              message: error?.message || String(error)
            }
          }
        };
      }
    })
  );

  const succeeded = results.filter(item => item.ok && item.executed).length;
  const failed = results.length - succeeded;

  return {
    httpStatus: failed === results.length ? 422 : 200,
    body: {
      ok: failed === 0,
      executed: succeeded > 0,
      mode: 'parallel_independent',
      version: PARALLEL_TOOL_EXECUTION_VERSION,
      requested: results.length,
      succeeded,
      failed,
      duration_ms: Date.now() - startedAt,
      results
    }
  };
}

module.exports = {
  PARALLEL_TOOL_EXECUTION_VERSION,
  MAX_PARALLEL_TASKS,
  SAFE_PARALLEL_SIDE_EFFECTS,
  normalizeParallelRequests,
  preflightParallelServices,
  parallelRequestContext,
  executeParallelServices
};
