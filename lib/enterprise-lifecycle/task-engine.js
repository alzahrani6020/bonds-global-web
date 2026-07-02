/**
 * Enterprise Lifecycle Task Engine
 *
 * Auto-generates tasks when an entity enters a stage and manages stage-exit cleanup.
 * Enforces completion rules when tasks are marked done.
 */

const { evaluateExpression } = require('./expression-evaluator');

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function getPath(obj, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function validateCompletionRules(task, context, evidence = []) {
  const rules = task.completion_rules || {};
  const failures = [];

  if (rules.requiredFields) {
    for (const field of rules.requiredFields) {
      if (!isPresent(getPath(context, field))) {
        failures.push(`Required field '${field}' is missing`);
      }
    }
  }

  if (rules.expression) {
    try {
      const exprResult = evaluateExpression(rules.expression, context);
      if (!exprResult) {
        failures.push(`Expression '${rules.expression}' evaluated to false`);
      }
    } catch (err) {
      failures.push(`Expression evaluation failed: ${err.message}`);
    }
  }

  if (rules.minEvidence) {
    const min = Number(rules.minEvidence);
    const count = Array.isArray(evidence) ? evidence.length : 0;
    if (count < min) {
      failures.push(`At least ${min} evidence item(s) required, got ${count}`);
    }
  }

  if (rules.allowedStatuses) {
    const allowed = Array.isArray(rules.allowedStatuses) ? rules.allowedStatuses : [rules.allowedStatuses];
    if (!allowed.includes(task.status)) {
      failures.push(`Task status '${task.status}' not in allowed statuses`);
    }
  }

  return failures;
}

class TaskEngine {
  constructor(registry) {
    this.registry = registry;
  }

  async generateTasks({ instanceId, stageCode, workflowCode, store, createdBy }) {
    const definitions = this.registry.getStageTasks(workflowCode, stageCode);
    const tasks = [];
    for (const def of definitions) {
      const deadline = def.deadlineDays
        ? new Date(Date.now() + def.deadlineDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const task = await store.createTask({
        instance_id: instanceId,
        stage_id: stageCode,
        task_code: def.code,
        title: def.title && typeof def.title === 'object' ? def.title.en || def.title.ar || def.code : def.title,
        title_ar: def.title && typeof def.title === 'object' ? def.title.ar : null,
        title_en: def.title && typeof def.title === 'object' ? def.title.en : null,
        owner_role: def.ownerRole || 'owner',
        priority: def.priority || 'medium',
        deadline,
        dependencies: def.dependencies || [],
        completion_rules: def.completionRules || {},
        status: 'pending',
        evidence: []
      });
      tasks.push(task);
    }
    return tasks;
  }

  async completeTask({ taskId, store, completedBy, evidence = [], context = {} }) {
    const task = await store.getTask(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'pending') throw new Error(`Task is not pending (status: ${task.status})`);

    const failures = validateCompletionRules(task, context, evidence);
    if (failures.length) {
      return {
        success: false,
        task,
        failures,
        message: `Task completion rules not met: ${failures.join('; ')}`
      };
    }

    const updated = await store.updateTask(task.id, {
      status: 'completed',
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
      evidence: Array.isArray(evidence) ? evidence : [evidence]
    });

    return { success: true, task: updated };
  }

  async completeStageTasks({ instanceId, stageCode, store, completedBy }) {
    const tasks = await store.listTasks(instanceId, { stage_id: stageCode, status: 'pending' });
    const results = [];
    for (const task of tasks) {
      const updated = await store.updateTask(task.id, {
        status: 'completed',
        completed_by: completedBy,
        completed_at: new Date().toISOString()
      });
      results.push(updated);
    }
    return results;
  }

  async cancelStageTasks({ instanceId, stageCode, store }) {
    const tasks = await store.listTasks(instanceId, { stage_id: stageCode, status: 'pending' });
    const results = [];
    for (const task of tasks) {
      const updated = await store.updateTask(task.id, { status: 'cancelled' });
      results.push(updated);
    }
    return results;
  }
}

module.exports = { TaskEngine, validateCompletionRules };
