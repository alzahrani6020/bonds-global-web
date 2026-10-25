'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const METHODS = new Set(['equal_principal', 'annuity', 'bullet']);

function positiveInteger(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function debtScheduleAnalysis(input = {}) {
  const facilities = Array.isArray(input.facilities) ? input.facilities : [];
  const required = [];

  if (!facilities.length) required.push('facilities');

  const normalized = facilities.map((facility, index) => {
    const principal = finite(facility?.principal);
    const annualRatePct = finite(facility?.annual_rate_pct);
    const termPeriods = positiveInteger(facility?.term_periods);
    const periodsPerYear = positiveInteger(facility?.periods_per_year, 12);
    const startPeriod = positiveInteger(facility?.start_period, 1);
    const method = String(facility?.amortization_method || 'equal_principal').trim();

    if (principal === null || principal <= 0) required.push(`facilities[${index}].principal_positive`);
    if (annualRatePct === null || annualRatePct < 0) required.push(`facilities[${index}].annual_rate_pct_non_negative`);
    if (!termPeriods) required.push(`facilities[${index}].term_periods_positive_integer`);
    if (!periodsPerYear) required.push(`facilities[${index}].periods_per_year_positive_integer`);
    if (!METHODS.has(method)) required.push(`facilities[${index}].amortization_method_supported`);

    return {
      id: String(facility?.id || facility?.code || `facility_${index + 1}`),
      principal,
      annualRatePct,
      termPeriods,
      periodsPerYear,
      startPeriod,
      method
    };
  });

  if (required.length) {
    return envelope('debt_schedule', {}, input, {
      supported_amortization_methods: [...METHODS]
    }, required);
  }

  const facilitySchedules = [];
  const aggregate = new Map();

  for (const facility of normalized) {
    const periodicRate = (facility.annualRatePct / 100) / facility.periodsPerYear;
    let balance = facility.principal;
    let annuityPayment = null;

    if (facility.method === 'annuity') {
      annuityPayment = periodicRate === 0
        ? facility.principal / facility.termPeriods
        : facility.principal * periodicRate /
          (1 - Math.pow(1 + periodicRate, -facility.termPeriods));
    }

    const rows = [];

    for (let i = 1; i <= facility.termPeriods; i++) {
      const period = facility.startPeriod + i - 1;
      const openingPrincipal = balance;
      const interestPayment = openingPrincipal * periodicRate;
      let principalPayment;

      if (facility.method === 'bullet') {
        principalPayment = i === facility.termPeriods ? openingPrincipal : 0;
      } else if (facility.method === 'annuity') {
        principalPayment = i === facility.termPeriods
          ? openingPrincipal
          : Math.max(0, annuityPayment - interestPayment);
      } else {
        principalPayment = i === facility.termPeriods
          ? openingPrincipal
          : facility.principal / facility.termPeriods;
      }

      principalPayment = Math.min(principalPayment, openingPrincipal);
      balance = Math.max(0, openingPrincipal - principalPayment);
      const debtService = principalPayment + interestPayment;

      const row = {
        period,
        opening_principal: money(openingPrincipal),
        principal_payment: money(principalPayment),
        interest_payment: money(interestPayment),
        debt_service: money(debtService),
        closing_principal: money(balance)
      };
      rows.push(row);

      const current = aggregate.get(period) || {
        period,
        principal_payment: 0,
        interest_payment: 0,
        debt_service: 0,
        closing_principal: 0
      };
      current.principal_payment += principalPayment;
      current.interest_payment += interestPayment;
      current.debt_service += debtService;
      current.closing_principal += balance;
      aggregate.set(period, current);
    }

    facilitySchedules.push({
      facility_id: facility.id,
      amortization_method: facility.method,
      annual_rate_pct: facility.annualRatePct,
      term_periods: facility.termPeriods,
      periods_per_year: facility.periodsPerYear,
      maturity_period: facility.startPeriod + facility.termPeriods - 1,
      schedule: rows
    });
  }

  const combinedSchedule = [...aggregate.values()]
    .sort((a, b) => a.period - b.period)
    .map(row => ({
      period: row.period,
      principal_payment: money(row.principal_payment),
      interest_payment: money(row.interest_payment),
      debt_service: money(row.debt_service),
      closing_principal: money(row.closing_principal)
    }));

  const totalPrincipal = normalized.reduce((sum, x) => sum + x.principal, 0);
  const totalInterest = combinedSchedule.reduce((sum, x) => sum + x.interest_payment, 0);
  const totalDebtService = combinedSchedule.reduce((sum, x) => sum + x.debt_service, 0);
  const peak = combinedSchedule.reduce(
    (best, row) => !best || row.debt_service > best.debt_service ? row : best,
    null
  );
  const weightedAverageRatePct = totalPrincipal > 0
    ? normalized.reduce((sum, x) => sum + x.principal * x.annualRatePct, 0) / totalPrincipal
    : null;
  const weightedAverageMaturityPeriods = totalPrincipal > 0
    ? normalized.reduce(
      (sum, x) => sum + x.principal * (x.startPeriod + x.termPeriods - 1),
      0
    ) / totalPrincipal
    : null;

  return envelope('debt_schedule', {
    facility_count: normalized.length,
    total_principal: money(totalPrincipal),
    total_interest: money(totalInterest),
    total_debt_service: money(totalDebtService),
    weighted_average_rate_pct: weightedAverageRatePct,
    weighted_average_maturity_periods: weightedAverageMaturityPeriods,
    peak_debt_service: peak?.debt_service ?? null,
    peak_debt_service_period: peak?.period ?? null,
    facilities: facilitySchedules,
    combined_schedule: combinedSchedule
  }, input, {
    amortization_methods: [...METHODS],
    deterministic_schedule: true
  });
}

module.exports = { debtScheduleAnalysis };
