'use strict';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeDiv(a, b) {
  const x = finite(a);
  const y = finite(b);
  if (x === null || y === null || y === 0) return null;
  return x / y;
}

function sumValues(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + (finite(item) || 0), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + (finite(item) || 0), 0);
  }
  return finite(value) || 0;
}

function pct(value) {
  return value === null ? null : value * 100;
}

function npv(rate, cashFlows, initialInvestment = 0) {
  const r = finite(rate);
  if (r === null || r <= -1) return null;
  let value = -(finite(initialInvestment) || 0);
  (cashFlows || []).forEach((cashFlow, index) => {
    value += (finite(cashFlow) || 0) / Math.pow(1 + r, index + 1);
  });
  return value;
}

function irr(cashFlows, initialInvestment = 0) {
  const flows = [-(finite(initialInvestment) || 0), ...(cashFlows || []).map(v => finite(v) || 0)];
  const hasPositive = flows.some(v => v > 0);
  const hasNegative = flows.some(v => v < 0);
  if (!hasPositive || !hasNegative) return null;

  const valueAt = rate => flows.reduce(
    (sum, flow, index) => sum + flow / Math.pow(1 + rate, index),
    0
  );

  let low = -0.99;
  let high = 10;
  let lowValue = valueAt(low);
  let highValue = valueAt(high);
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 160; i++) {
    const mid = (low + high) / 2;
    const midValue = valueAt(mid);
    if (Math.abs(midValue) < 1e-7) return mid;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return (low + high) / 2;
}

function paybackPeriod(initialInvestment, cashFlows) {
  const target = finite(initialInvestment);
  if (target === null || target <= 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < (cashFlows || []).length; i++) {
    const flow = finite(cashFlows[i]) || 0;
    const before = cumulative;
    cumulative += flow;
    if (cumulative >= target && flow > 0) {
      return i + (target - before) / flow;
    }
  }
  return null;
}

module.exports = {
  finite,
  clamp,
  safeDiv,
  sumValues,
  pct,
  npv,
  irr,
  paybackPeriod
};
