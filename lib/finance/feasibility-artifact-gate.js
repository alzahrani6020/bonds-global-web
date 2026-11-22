'use strict';

/**
 * Publication gate, not a claim that the supporting commercial assumptions
 * have been independently verified. Never archive a partial orchestrator
 * response as a completed feasibility study.
 */
function assessFeasibilityArtifact(response) {
  const computed = response?.result?.engineResults?.feasibility;
  const metrics = computed?.metrics;
  const required = Array.isArray(computed?.required_inputs)
    ? computed.required_inputs.filter(x => typeof x === 'string' && x.trim())
    : [];
  const valid = computed?.executed === true &&
    computed?.ok === true &&
    metrics && typeof metrics === 'object' &&
    Number.isFinite(metrics.npv) &&
    Number.isFinite(metrics.irr) &&
    Number.isFinite(metrics.initial_investment) &&
    metrics.initial_investment > 0 &&
    Number.isFinite(metrics.discount_rate) &&
    Array.isArray(metrics.cash_flows) &&
    metrics.cash_flows.length > 0 &&
    metrics.cash_flows.every(Number.isFinite) &&
    required.length === 0;
  return {
    complete: !!valid,
    required_inputs: required.length ? required : (valid ? [] : ['verified_financial_calculation'])
  };
}

module.exports = { assessFeasibilityArtifact };
