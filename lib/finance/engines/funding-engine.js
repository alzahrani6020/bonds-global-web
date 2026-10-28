'use strict';

const { finite, clamp, safeDiv, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function fundingReadiness(input = {}) {
  const ebitda = finite(input.ebitda);
  const annualDebtService = finite(input.annual_debt_service);
  const currentAssets = finite(input.current_assets);
  const currentLiabilities = finite(input.current_liabilities);
  const debt = finite(input.total_debt);
  const equity = finite(input.equity);
  const operatingCashFlow = finite(input.operating_cash_flow);
  const requestedAmount = finite(input.requested_amount);
  const capacityRequested = Object.prototype.hasOwnProperty.call(input, 'minimum_dscr');
  const minimumDscr = finite(input.minimum_dscr);

  const dscr = safeDiv(operatingCashFlow ?? ebitda, annualDebtService);
  const currentRatio = safeDiv(currentAssets, currentLiabilities);
  const leverage = safeDiv(debt, equity);
  const amountToCashFlow = safeDiv(requestedAmount, operatingCashFlow ?? ebitda);

  const components = [];
  if (dscr !== null) components.push({ key: 'dscr', weight: 0.40, score: clamp((dscr / 1.5) * 100, 0, 100) });
  if (currentRatio !== null) components.push({ key: 'liquidity', weight: 0.25, score: clamp((currentRatio / 1.5) * 100, 0, 100) });
  if (leverage !== null) components.push({ key: 'leverage', weight: 0.25, score: clamp(100 - leverage * 25, 0, 100) });
  if (amountToCashFlow !== null) components.push({ key: 'requested_amount', weight: 0.10, score: clamp(100 - amountToCashFlow * 12, 0, 100) });

  const totalWeight = components.reduce((s, row) => s + row.weight, 0);
  const score = totalWeight
    ? Math.round(components.reduce((s, row) => s + row.score * row.weight, 0) / totalWeight)
    : null;

  const cashFlowBasis = operatingCashFlow ?? ebitda;
  const debtServiceCapacity =
    capacityRequested && minimumDscr !== null && minimumDscr > 0 && cashFlowBasis !== null && annualDebtService !== null
      ? (() => {
        const maximumAnnualDebtService = cashFlowBasis / minimumDscr;
        const signedHeadroom = maximumAnnualDebtService - annualDebtService;
        return {
          minimum_dscr: minimumDscr,
          cash_flow_basis: cashFlowBasis,
          current_annual_debt_service: annualDebtService,
          maximum_annual_debt_service: maximumAnnualDebtService,
          annual_debt_service_headroom: Math.max(0, signedHeadroom),
          annual_debt_service_excess: Math.max(0, -signedHeadroom),
          status: signedHeadroom >= 0 ? 'capacity_available' : 'capacity_exceeded'
        };
      })()
      : null;

  const metrics = {
    readiness_score: score,
    readiness_band: score === null ? 'unknown' : score >= 80 ? 'strong' : score >= 65 ? 'moderate' : score >= 50 ? 'weak' : 'not_ready',
    dscr,
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    requested_amount_to_cash_flow: amountToCashFlow,
    debt_service_capacity: debtServiceCapacity,
    components
  };

  const required = [];
  if (ebitda === null && operatingCashFlow === null) required.push('ebitda_or_operating_cash_flow');
  if (annualDebtService === null) required.push('annual_debt_service');
  if (capacityRequested && (minimumDscr === null || minimumDscr <= 0)) {
    required.push('minimum_dscr_positive');
  }

  return envelope('funding_readiness', metrics, input, {
    debt_service_capacity_method:
      capacityRequested ? 'cash_flow_basis_divided_by_minimum_dscr_less_current_debt_service' : null
  }, required);
}

function creditworthiness(input = {}) {
  const readiness = fundingReadiness(input);
  const netIncome = finite(input.net_income);
  const revenue = finite(input.revenue);
  const profitability = revenue && netIncome !== null ? netIncome / revenue : null;

  let score = readiness.metrics.readiness_score;
  if (score !== null && profitability !== null) {
    score = Math.round(clamp(score * 0.85 + clamp((profitability + 0.05) / 0.25 * 100, 0, 100) * 0.15, 0, 100));
  }

  const metrics = {
    credit_score: score,
    rating_band: score === null ? 'unrated' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'E',
    risk_band: score === null ? 'unknown' : score >= 75 ? 'low' : score >= 60 ? 'moderate' : score >= 45 ? 'high' : 'very_high',
    dscr: readiness.metrics.dscr,
    current_ratio: readiness.metrics.current_ratio,
    debt_to_equity: readiness.metrics.debt_to_equity,
    net_margin_pct: profitability === null ? null : pct(profitability)
  };

  return envelope('creditworthiness', metrics, input, {}, readiness.required_inputs);
}

module.exports = { fundingReadiness, creditworthiness };
