'use strict';

const { finite, clamp, safeDiv } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function riskAnalysis(input = {}) {
  const currentRatio = safeDiv(input.current_assets, input.current_liabilities);
  const leverage = safeDiv(input.total_debt, input.equity);
  const dscr = safeDiv(
    finite(input.operating_cash_flow) ?? finite(input.ebitda),
    input.annual_debt_service
  );
  const concentration = finite(input.customer_concentration_pct);
  const cashBufferMonths = finite(input.cash_buffer_months);

  const factors = [];
  if (currentRatio !== null) factors.push({ key: 'liquidity', risk: clamp(100 - currentRatio * 55, 0, 100), weight: 0.25 });
  if (leverage !== null) factors.push({ key: 'leverage', risk: clamp(leverage * 25, 0, 100), weight: 0.25 });
  if (dscr !== null) factors.push({ key: 'debt_service', risk: clamp(100 - dscr * 60, 0, 100), weight: 0.25 });
  if (concentration !== null) factors.push({ key: 'concentration', risk: clamp(concentration, 0, 100), weight: 0.15 });
  if (cashBufferMonths !== null) factors.push({ key: 'cash_buffer', risk: clamp(100 - cashBufferMonths * 16.67, 0, 100), weight: 0.10 });

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = totalWeight
    ? Math.round(factors.reduce((s, f) => s + f.risk * f.weight, 0) / totalWeight)
    : null;

  const metrics = {
    risk_score: score,
    risk_band: score === null ? 'unknown' : score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'high' : 'critical',
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    dscr,
    customer_concentration_pct: concentration,
    cash_buffer_months: cashBufferMonths,
    factors
  };

  const required = factors.length ? [] : ['financial_risk_inputs'];
  return envelope('risk_analysis', metrics, input, {}, required);
}

module.exports = { riskAnalysis };
