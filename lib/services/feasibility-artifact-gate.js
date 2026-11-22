'use strict';

// A successful HTTP/orchestrator response is not a completed financial study.
// Return machine-readable reasons; do not infer missing numbers as zero.
function feasibilityArtifactGate(result, suppliedInputs) {
  const engine = result?.result?.engineResults?.feasibility;
  const inputs = suppliedInputs && typeof suppliedInputs === 'object' && !Array.isArray(suppliedInputs)
    ? suppliedInputs : {};
  if (!engine || engine.executed !== true || engine.ok === false ||
      (Array.isArray(engine.required_inputs) && engine.required_inputs.length)) {
    return { eligible: false, reason: 'FEASIBILITY_NOT_CALCULATED' };
  }

  const metrics = engine.metrics;
  if (!metrics || !Number.isFinite(metrics.npv) || !Number.isFinite(metrics.irr)) {
    return { eligible: false, reason: 'FEASIBILITY_METRICS_INCOMPLETE' };
  }

  // The production engine accepts investment_amount as its initial_investment.
  // Both the rate and the cash flows must have been provided explicitly.
  const investment = inputs.initial_investment ?? inputs.investment_amount;
  const cashFlows = inputs.cash_flows;
  const annualFlow = inputs.annual_cash_flow;
  const hasInvestment = investment !== null && investment !== '' && Number.isFinite(Number(investment)) && Number(investment) >= 0;
  const hasCashFlows = Array.isArray(cashFlows)
    ? cashFlows.length > 0 && cashFlows.length <= 60 &&
      cashFlows.every(value => value !== null && value !== '' && Number.isFinite(Number(value)))
    : annualFlow !== null && annualFlow !== '' && annualFlow !== undefined && Number.isFinite(Number(annualFlow));
  const rate = inputs.discount_rate;
  const hasRate = rate !== null && rate !== '' && rate !== undefined && Number.isFinite(Number(rate)) && Number(rate) >= 0 && Number(rate) <= 1;

  if (!hasInvestment || !hasCashFlows || !hasRate) {
    return { eligible: false, reason: 'FEASIBILITY_EVIDENCE_INPUTS_INCOMPLETE' };
  }

  return { eligible: true, reason: null };
}

module.exports = { feasibilityArtifactGate };
