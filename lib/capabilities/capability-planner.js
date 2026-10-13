'use strict';

const { getCapability, validateCapabilityInput } = require('./bonds-capability-registry');

function planCapabilities(request = {}) {
  const actions = Array.isArray(request.actions)
    ? request.actions
    : (request.action ? [request.action] : []);
  const inputs = request.inputs && typeof request.inputs === 'object' ? request.inputs : {};
  const steps = [];
  const missingInputs = [];

  for (const actionRaw of actions) {
    const action = String(actionRaw || '').trim();
    const spec = getCapability(action);
    if (!spec) {
      steps.push({ action, executable: false, error: 'UNKNOWN_CAPABILITY' });
      continue;
    }
    const input = inputs[action] || request.input || {};
    const validation = validateCapabilityInput(action, input);
    if (!validation.valid) {
      missingInputs.push({ action, missing: validation.missing });
    }
    steps.push({
      action,
      capability_id: spec.id,
      purpose: spec.purpose,
      side_effect: spec.sideEffect,
      input,
      executable: validation.valid,
      missing: validation.missing
    });
  }

  return {
    schema: 'BONDS_CAPABILITY_PLAN_V1',
    steps,
    executable: steps.length > 0 && steps.every(step => step.executable === true),
    requires_governed_execution: steps.some(step => step.side_effect !== 'none'),
    missing_inputs: missingInputs
  };
}

module.exports = { planCapabilities };
