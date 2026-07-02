/**
 * Enterprise Lifecycle Gate Engine
 *
 * Evaluates transition guards in a registry-driven way.
 * No hard-coded business logic; guard type maps to a pluggable evaluator.
 */

function getPath(obj, path) {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

const { evaluateExpression } = require('./expression-evaluator');

const defaultEvaluators = {
  data_completeness: (guard, context) => {
    const fields = guard.requiredFields || [];
    if (!fields.length) return { passed: true, score: 100, evidence: [] };
    const present = fields.filter(f => isPresent(getPath(context, f)));
    const score = Math.round((present.length / fields.length) * 100);
    const rawThreshold = guard.threshold || 0;
    const threshold = rawThreshold <= 1 ? rawThreshold * 100 : rawThreshold;
    const passed = score >= threshold;
    return {
      passed,
      score,
      threshold,
      evidence: fields.map(f => ({
        field: f,
        present: isPresent(getPath(context, f)),
        value: getPath(context, f)
      })),
      reason: passed
        ? `Data completeness ${score}% meets threshold ${threshold}%`
        : `Data completeness ${score}% below threshold ${threshold}%`
    };
  },

  confidence_threshold: (guard, context) => {
    const value = getPath(context, guard.contextPath);
    const score = value === undefined ? 0 : Number(value);
    const passed = score >= (guard.threshold || 0);
    return {
      passed,
      score,
      threshold: guard.threshold,
      evidence: [{ contextPath: guard.contextPath, value: score, threshold: guard.threshold }],
      reason: passed
        ? `Confidence ${score} meets threshold ${guard.threshold}`
        : `Confidence ${score} below threshold ${guard.threshold}`
    };
  },

  document_status: (guard, context) => {
    const docs = getPath(context, 'documents') || {};
    const doc = docs[guard.documentType];
    const status = doc ? doc.status : undefined;
    const allowed = guard.allowedStatuses || [];
    const passed = allowed.includes(status);
    return {
      passed,
      score: passed ? 100 : 0,
      evidence: [{ documentType: guard.documentType, status, allowed }],
      reason: passed
        ? `Document ${guard.documentType} status '${status}' is allowed`
        : `Document ${guard.documentType} status '${status}' not in [${allowed.join(', ')}]`
    };
  },

  approval_status: (guard, context) => {
    const approvals = getPath(context, 'approvals') || {};
    const approval = approvals[guard.approvalId || guard.approvalType];
    const status = approval ? approval.status : undefined;
    const passed = status === 'approved';
    return {
      passed,
      score: passed ? 100 : 0,
      evidence: [{ approvalId: guard.approvalId, approvalType: guard.approvalType, status }],
      reason: passed
        ? `Approval ${guard.approvalId || guard.approvalType} is approved`
        : `Approval ${guard.approvalId || guard.approvalType} status is '${status}'`
    };
  },

  task_completion: (guard, context) => {
    const tasks = getPath(context, 'tasks') || [];
    const stageId = guard.stageId || 'current';
    const taskCodes = guard.taskCodes || [];
    const required = guard.required || 'all'; // 'all' | 'any'

    const relevantTasks = stageId === 'current'
      ? tasks
      : tasks.filter(t => t.stage_id === stageId);

    const matches = relevantTasks.filter(t => taskCodes.length === 0 || taskCodes.includes(t.task_code));
    const completed = matches.filter(t => t.status === 'completed');

    let passed = false;
    if (taskCodes.length === 0) {
      passed = matches.every(t => t.status === 'completed');
    } else if (required === 'all') {
      passed = taskCodes.every(code => matches.some(t => t.task_code === code && t.status === 'completed'));
    } else {
      passed = completed.length > 0;
    }

    const score = matches.length ? Math.round((completed.length / matches.length) * 100) : 100;

    return {
      passed,
      score,
      evidence: matches.map(t => ({ taskCode: t.task_code, status: t.status, stageId: t.stage_id })),
      reason: passed
        ? `Required tasks completed (${completed.length}/${matches.length})`
        : `Required tasks not completed (${completed.length}/${matches.length})`
    };
  },

  expression: (guard, context) => {
    const expression = guard.expression || guard.value;
    if (!expression) {
      return {
        passed: false,
        score: 0,
        evidence: [],
        reason: 'Expression guard has no expression'
      };
    }
    try {
      const result = evaluateExpression(expression, context);
      const passed = !!result;
      return {
        passed,
        score: passed ? 100 : 0,
        evidence: [{ expression, result }],
        reason: passed
          ? `Expression '${expression}' evaluated to true`
          : `Expression '${expression}' evaluated to ${JSON.stringify(result)}`
      };
    } catch (err) {
      return {
        passed: false,
        score: 0,
        evidence: [{ expression, error: err.message }],
        reason: `Expression evaluation failed: ${err.message}`
      };
    }
  }
};

class GateEngine {
  constructor(customEvaluators = {}) {
    this.evaluators = { ...defaultEvaluators, ...customEvaluators };
  }

  evaluate(guard, context) {
    const evaluator = this.evaluators[guard.type];
    if (!evaluator) {
      return {
        passed: false,
        score: 0,
        evidence: [],
        reason: `Unknown guard type '${guard.type}'`
      };
    }
    const result = evaluator(guard, context);
    return {
      gateId: guard.id || guard.name,
      gateType: guard.type,
      passed: !!result.passed,
      score: Number(result.score) || 0,
      threshold: result.threshold,
      evidence: result.evidence || [],
      reason: result.reason || ''
    };
  }

  evaluateAll(guards, context) {
    const results = guards.map(g => this.evaluate(g, context));
    const passed = results.every(r => r.passed);
    const confidence = results.length
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 100;
    return { passed, confidence, results };
  }

  registerEvaluator(type, fn) {
    this.evaluators[type] = fn;
  }
}

module.exports = { GateEngine, getPath, isPresent };
