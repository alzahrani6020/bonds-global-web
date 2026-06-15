/**
 * Bonds V3 — Advanced Scenario Engine
 *
 * Applies economic/operational shocks to a project model and recalculates
 * financial metrics for sensitivity analysis.
 */

const { calculate } = require('./calculator');

function round(num, decimals = 2) {
  return Number.isFinite(num) ? Number(num.toFixed(decimals)) : num;
}

const SUPPORTED_ASSUMPTION_CODES = new Set([
  'revenue_growth_rate',
  'cogs_ratio',
  'rent_ratio',
  'salaries_ratio',
  'marketing_ratio',
  'utilities_ratio',
  'interest_rate',
  'discount_rate',
  'loan_ratio',
  'corporate_tax_rate',
  'working_capital_days',
  'annual_depreciation_rate'
]);

const SUPPORTED_OPTION_CODES = new Set(['revenue', 'capex']);

/**
 * Apply shocks to a copy of assumptions.
 * @param {Array} assumptions — array of { code, unit_type, value, ... }
 * @param {Array} shocks — array of { code, type: 'relative' | 'absolute', value }
 * @returns {Array} adjusted assumptions
 */
function applyShocks(assumptions, shocks) {
  const adjusted = assumptions.map(a => ({ ...a }));

  for (const shock of shocks || []) {
    if (!SUPPORTED_ASSUMPTION_CODES.has(shock.code)) continue;

    const idx = adjusted.findIndex(a => a.code === shock.code);
    if (idx < 0) continue;

    const isPercentage = adjusted[idx].unit_type === 'percentage';
    const currentValue = Number(adjusted[idx].value);
    if (Number.isNaN(currentValue)) continue;

    let newValue;
    if (shock.type === 'absolute') {
      // For percentage assumptions, absolute value is in storage format (e.g. 25 for 25%)
      newValue = shock.value;
    } else {
      // Relative: multiply current raw value by (1 + shock.value)
      newValue = currentValue * (1 + Number(shock.value));
    }

    // Clamp within reasonable bounds
    if (isPercentage) {
      newValue = Math.max(0, Math.min(100, newValue));
    } else {
      newValue = Math.max(0, newValue);
    }

    adjusted[idx].value = round(newValue, isPercentage ? 2 : 4);
  }

  return adjusted;
}

function median(a, b) {
  return (Number(a) + Number(b)) / 2;
}

/**
 * Apply revenue/capex shocks to calculate options.
 */
function applyOptionShocks(baseOptions, modelData, shocks) {
  const model = modelData.projectModel || {};
  const newOptions = { ...baseOptions };

  const baseRevenue = baseOptions.revenue || median(model.revenue_min, model.revenue_max);
  const baseCapex = baseOptions.capex || median(model.capex_min, model.capex_max);

  for (const shock of shocks || []) {
    if (shock.code === 'revenue') {
      if (shock.type === 'absolute') {
        newOptions.revenue = Number(shock.value);
      } else {
        newOptions.revenue = baseRevenue * (1 + Number(shock.value));
      }
    }
    if (shock.code === 'capex') {
      if (shock.type === 'absolute') {
        newOptions.capex = Number(shock.value);
      } else {
        newOptions.capex = baseCapex * (1 + Number(shock.value));
      }
    }
  }

  return newOptions;
}

/**
 * Calculate a single scenario.
 * @param {Object} modelData — loaded project model data
 * @param {Object} baseOptions — options passed to calculate() for baseline
 * @param {Object} scenario — { name, shocks, riskScoreDelta }
 * @returns {Object} calculation result with scenario name
 */
function calculateScenario(modelData, baseOptions = {}, scenario = {}) {
  const modelDataCopy = {
    ...modelData,
    assumptions: applyShocks(modelData.assumptions || [], scenario.shocks)
  };

  const newOptions = applyOptionShocks(baseOptions, modelData, scenario.shocks);
  const result = calculate(modelDataCopy, newOptions);

  // Apply optional risk score delta
  if (scenario.riskScoreDelta) {
    result.risk.score = round(Math.min(100, Math.max(0, result.risk.score + scenario.riskScoreDelta)), 1);
    result.risk.level = result.risk.score < 40 ? 'low' : result.risk.score < 60 ? 'medium' : 'high';
  }

  return {
    name: scenario.name || 'سيناريو',
    shocks: scenario.shocks || [],
    riskScoreDelta: scenario.riskScoreDelta || 0,
    result
  };
}

/**
 * Run baseline + multiple scenarios and produce comparisons.
 */
function runScenarios(modelData, baseOptions = {}, scenarios = []) {
  const baseline = calculate(modelData, baseOptions);

  const scenarioResults = (scenarios || []).map(scenario =>
    calculateScenario(modelData, baseOptions, scenario)
  );

  return {
    baseline,
    scenarios: scenarioResults.map(sr => ({
      ...sr,
      comparison: compareScenario(baseline, sr.result)
    }))
  };
}

/**
 * Compare a scenario result to baseline.
 */
function compareScenario(baseline, scenarioResult) {
  const b = baseline.summary;
  const s = scenarioResult.summary;

  return {
    deltaNpv: round((s.npv || 0) - (b.npv || 0)),
    deltaIrr: round((s.irr || 0) - (b.irr || 0), 2),
    deltaPaybackMonths: round((s.paybackMonths || 0) - (b.paybackMonths || 0), 1),
    deltaBreakEvenRevenue: round((s.breakEvenRevenue || 0) - (b.breakEvenRevenue || 0)),
    deltaDscr: round((s.dscr || 0) - (b.dscr || 0), 2),
    deltaRiskScore: round((scenarioResult.risk.score || 0) - (baseline.risk.score || 0), 1),
    impact: classifyImpact(
      (s.npv || 0) - (b.npv || 0),
      (s.irr || 0) - (b.irr || 0),
      scenarioResult.risk.score - baseline.risk.score
    )
  };
}

function classifyImpact(deltaNpv, deltaIrr, deltaRisk) {
  if (deltaNpv > 0 && deltaIrr >= 0 && deltaRisk <= 0) return 'positive';
  if (deltaNpv < 0 && deltaIrr < -3) return 'danger';
  if (deltaNpv < 0 || deltaRisk > 5) return 'warning';
  return 'neutral';
}

/**
 * Get a preset scenario by name.
 */
function getPreset(name) {
  const presets = {
    recession: {
      name: 'سيناريو الركود',
      shocks: [
        { code: 'revenue', type: 'relative', value: -0.15 },
        { code: 'revenue_growth_rate', type: 'relative', value: -0.50 },
        { code: 'marketing_ratio', type: 'relative', value: 0.10 }
      ],
      riskScoreDelta: 10
    },
    high_inflation: {
      name: 'سيناريو التضخم المرتفع',
      shocks: [
        { code: 'interest_rate', type: 'relative', value: 0.25 },
        { code: 'discount_rate', type: 'relative', value: 0.15 },
        { code: 'utilities_ratio', type: 'relative', value: 0.08 },
        { code: 'cogs_ratio', type: 'relative', value: 0.05 }
      ],
      riskScoreDelta: 5
    },
    labor_shortage: {
      name: 'سيناريو نقص العمالة',
      shocks: [
        { code: 'salaries_ratio', type: 'relative', value: 0.15 },
        { code: 'utilities_ratio', type: 'relative', value: 0.03 }
      ],
      riskScoreDelta: 8
    },
    rent_boom: {
      name: 'سيناريو ارتفاع الإيجارات',
      shocks: [
        { code: 'rent_ratio', type: 'relative', value: 0.12 }
      ],
      riskScoreDelta: 4
    },
    sales_drop: {
      name: 'سيناريو انخفاض المبيعات',
      shocks: [
        { code: 'revenue', type: 'relative', value: -0.20 },
        { code: 'marketing_ratio', type: 'relative', value: 0.15 }
      ],
      riskScoreDelta: 7
    }
  };

  return presets[name] || null;
}

/**
 * Normalize scenario input: supports preset or explicit shocks.
 */
function normalizeScenario(input) {
  if (input.preset) {
    const preset = getPreset(input.preset);
    if (!preset) throw new Error(`Unknown preset: ${input.preset}`);
    return {
      name: input.name || preset.name,
      shocks: preset.shocks,
      riskScoreDelta: preset.riskScoreDelta
    };
  }

  return {
    name: input.name || 'سيناريو مخصص',
    shocks: input.shocks || [],
    riskScoreDelta: input.riskScoreDelta || 0
  };
}

module.exports = {
  applyShocks,
  calculateScenario,
  runScenarios,
  compareScenario,
  getPreset,
  normalizeScenario
};
