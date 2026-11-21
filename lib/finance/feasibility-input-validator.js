'use strict';

// Input validation for feasibility execution. Runs before any engine call or
// project artifact write. Optional fields remain optional for legacy clients,
// but explicitly provided values must be valid and internally consistent.
const NUMERIC_FIELDS = Object.freeze([
  'initial_investment', 'investment_amount', 'annual_revenue',
  'cogs', 'operating_expenses', 'annual_cash_flow',
  'discount_rate', 'years'
]);
const NON_NEGATIVE = new Set([
  'initial_investment', 'investment_amount', 'annual_revenue',
  'cogs', 'operating_expenses'
]);
const PROJECT_SIZES = new Set(['household', 'micro', 'small', 'medium', 'large', 'mega']);

function isProvided(value) {
  return value !== null && value !== undefined && value !== '';
}
function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function validateFeasibilityInputs(values = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { valid: false, invalid_fields: ['values'] };
  }
  const invalid = [];
  for (const key of NUMERIC_FIELDS) {
    if (!isProvided(values[key])) continue;
    const value = finiteNumber(values[key]);
    if (value === null || (NON_NEGATIVE.has(key) && value < 0)) {
      invalid.push(key);
      continue;
    }
    if (key === 'years' && (!Number.isInteger(value) || value < 1 || value > 60)) {
      invalid.push(key);
    }
    if (key === 'discount_rate' && (value < 0 || value > 1)) {
      invalid.push(key);
    }
  }
  if (isProvided(values.project_size) && !PROJECT_SIZES.has(values.project_size)) {
    invalid.push('project_size');
  }
  if (isProvided(values.currency) &&
      (typeof values.currency !== 'string' || !/^[A-Z]{3}$/.test(values.currency))) {
    invalid.push('currency');
  }
  if (Object.prototype.hasOwnProperty.call(values, 'cash_flows')) {
    const flows = values.cash_flows;
    if (!Array.isArray(flows) || flows.length < 1 || flows.length > 60 ||
        flows.some(value => finiteNumber(value) === null)) {
      invalid.push('cash_flows');
    } else if (isProvided(values.years) && Number(values.years) !== flows.length) {
      invalid.push('cash_flows_years_mismatch');
    }
    if (!isProvided(values.discount_rate)) {
      invalid.push('discount_rate_required_for_cash_flows');
    }
  }
  return { valid: invalid.length === 0, invalid_fields: [...new Set(invalid)] };
}

module.exports = { validateFeasibilityInputs };
