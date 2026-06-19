/**
 * Enterprise Business Rules Engine — Bonds Global
 * Declarative rule registry + workflow transition validation.
 */
(function (root) {
  'use strict';

  const rules = new Map();
  const workflows = new Map();

  function register(name, fn, options = {}) {
    rules.set(name, { fn, message: options.message || `Rule ${name} failed.` });
  }

  function unregister(name) {
    rules.delete(name);
  }

  function evaluate(ruleName, context) {
    const rule = rules.get(ruleName);
    if (!rule) return { passed: true, message: null }; // unknown rules pass
    const passed = rule.fn(context);
    return { passed: !!passed, message: passed ? null : rule.message };
  }

  function evaluateAll(ruleNames, context) {
    const failures = [];
    ruleNames.forEach(name => {
      const res = evaluate(name, context);
      if (!res.passed) failures.push({ rule: name, message: res.message });
    });
    return {
      passed: failures.length === 0,
      failures
    };
  }

  function defineWorkflow(entityType, states, transitions) {
    const stateSet = new Set(states);
    transitions.forEach(t => {
      if (!stateSet.has(t.from) || !stateSet.has(t.to)) {
        throw new Error(`Invalid workflow transition ${t.from} -> ${t.to} for ${entityType}`);
      }
    });
    workflows.set(entityType, { states, transitions });
  }

  function canTransition(entityType, fromState, toState, context = {}) {
    const wf = workflows.get(entityType);
    if (!wf) return { allowed: false, reason: 'No workflow defined for entity type.' };
    const transition = wf.transitions.find(t => t.from === fromState && t.to === toState);
    if (!transition) return { allowed: false, reason: `Transition ${fromState} -> ${toState} is not allowed.` };
    if (transition.requiredRole && (!context.role || transition.requiredRole !== context.role)) {
      return { allowed: false, reason: `Requires role: ${transition.requiredRole}.` };
    }
    if (transition.requiresApproval && !context.approvedBy) {
      return { allowed: false, reason: 'Approval required.' };
    }
    if (transition.rules) {
      const res = evaluateAll(transition.rules, context);
      if (!res.passed) return { allowed: false, reason: res.failures.map(f => f.message).join('؛ ') };
    }
    return { allowed: true, transition };
  }

  function getAllowedTransitions(entityType, fromState, context = {}) {
    const wf = workflows.get(entityType);
    if (!wf) return [];
    return wf.transitions
      .filter(t => t.from === fromState && canTransition(entityType, fromState, t.to, context).allowed)
      .map(t => t.to);
  }

  function getInitialState(entityType) {
    const wf = workflows.get(entityType);
    return wf ? wf.states[0] : null;
  }

  // Built-in rules
  register('nonEmptyBudget', ctx => ctx.budget > 0, { message: 'الميزانية مطلوبة ويجب أن تكون أكبر من صفر.' });
  register('hasClient', ctx => !!ctx.clientId, { message: 'يجب ربط الكيان بعميل.' });
  register('notSelfApproval', ctx => ctx.actorId !== ctx.ownerId, { message: 'لا يمكن الموافقة على طلبك الخاص.' });
  register('requireEndDate', ctx => !!ctx.endDate, { message: 'تاريخ الانتهاء مطلوب.' });
  register('requireFeasibilityApproval', ctx => ctx.feasibilityStatus === 'approved', { message: 'يجب اعتماد دراسة الجدوى أولاً.' });

  // Built-in workflows
  defineWorkflow('advisory_project',
    ['draft', 'lead', 'proposal', 'active', 'on_hold', 'completed', 'cancelled'],
    [
      { from: 'draft', to: 'lead', rules: ['hasClient'] },
      { from: 'lead', to: 'proposal', rules: ['hasClient'] },
      { from: 'proposal', to: 'active', rules: ['hasClient', 'nonEmptyBudget'] },
      { from: 'active', to: 'on_hold' },
      { from: 'active', to: 'completed', rules: ['requireEndDate'] },
      { from: 'on_hold', to: 'active' },
      { from: 'proposal', to: 'cancelled' },
      { from: 'active', to: 'cancelled' }
    ]
  );

  defineWorkflow('recovery_asset',
    ['identified', 'valuation', 'planning', 'active_rescue', 'restructuring', 'recovered', 'liquidated', 'write_off'],
    [
      { from: 'identified', to: 'valuation', rules: ['hasClient'] },
      { from: 'valuation', to: 'planning', rules: ['nonEmptyBudget'] },
      { from: 'planning', to: 'active_rescue' },
      { from: 'active_rescue', to: 'restructuring' },
      { from: 'active_rescue', to: 'recovered' },
      { from: 'restructuring', to: 'recovered' },
      { from: 'restructuring', to: 'liquidated' },
      { from: 'active_rescue', to: 'liquidated' },
      { from: 'planning', to: 'write_off', requiresApproval: true }
    ]
  );

  defineWorkflow('funding_request',
    ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'funded'],
    [
      { from: 'draft', to: 'submitted', rules: ['hasClient', 'nonEmptyBudget'] },
      { from: 'submitted', to: 'under_review' },
      { from: 'under_review', to: 'approved', requiresApproval: true },
      { from: 'under_review', to: 'rejected', requiresApproval: true },
      { from: 'approved', to: 'funded' }
    ]
  );

  root.BondsRules = {
    register,
    unregister,
    evaluate,
    evaluateAll,
    defineWorkflow,
    canTransition,
    getAllowedTransitions,
    getInitialState,
    getWorkflows: () => Array.from(workflows.keys())
  };
})(window);
