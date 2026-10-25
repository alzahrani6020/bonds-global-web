'use strict';

const { SimulationEngine } = require('../../decision-os/simulation-engine');
const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function reverseStressAnalysis(input = {}) {
  const cases = Array.isArray(input.reverse_stress_cases)
    ? input.reverse_stress_cases
    : [];
  const required = [];

  if (!cases.length) required.push('reverse_stress_cases');

  const results = cases.map((item, index) => {
    const metric = String(item?.metric || '').trim();
    const shockDirection = String(item?.shock_direction || '').trim();
    const baseline = finite(item?.baseline_value);
    const threshold = finite(item?.failure_threshold);
    const sensitivity = finite(item?.metric_change_per_1pct_shock);
    const maxShock = finite(item?.max_shock_pct);

    if (!metric) required.push(`reverse_stress_cases[${index}].metric`);
    if (!['increase', 'decrease'].includes(shockDirection)) {
      required.push(`reverse_stress_cases[${index}].shock_direction_increase_or_decrease`);
    }
    if (baseline === null) required.push(`reverse_stress_cases[${index}].baseline_value_numeric`);
    if (threshold === null) required.push(`reverse_stress_cases[${index}].failure_threshold_numeric`);
    if (sensitivity === null || sensitivity <= 0) {
      required.push(`reverse_stress_cases[${index}].metric_change_per_1pct_shock_positive`);
    }
    if (maxShock !== null && maxShock < 0) {
      required.push(`reverse_stress_cases[${index}].max_shock_pct_non_negative`);
    }

    let requiredShockPct = null;
    if (
      baseline !== null &&
      threshold !== null &&
      sensitivity !== null &&
      sensitivity > 0 &&
      ['increase', 'decrease'].includes(shockDirection)
    ) {
      const distance = shockDirection === 'decrease'
        ? baseline - threshold
        : threshold - baseline;

      if (distance < 0) {
        required.push(`reverse_stress_cases[${index}].failure_threshold_consistent_with_direction`);
      } else {
        requiredShockPct = distance / sensitivity;
      }
    }

    const stressedMetricAtMax = maxShock === null || baseline === null || sensitivity === null
      ? null
      : shockDirection === 'decrease'
        ? baseline - sensitivity * maxShock
        : baseline + sensitivity * maxShock;

    return {
      metric,
      shock_direction: shockDirection,
      baseline_value: baseline,
      failure_threshold: threshold,
      metric_change_per_1pct_shock: sensitivity,
      required_shock_pct: requiredShockPct,
      max_shock_pct: maxShock,
      breach_within_max_shock:
        maxShock === null || requiredShockPct === null
          ? null
          : requiredShockPct <= maxShock,
      stressed_metric_at_max_shock: stressedMetricAtMax
    };
  });

  if (required.length) {
    return envelope(
      'scenario_forecast',
      {},
      input,
      {
        service_scope: 'reverse_stress_testing',
        method: 'explicit_linear_sensitivity_reverse_solve',
        fail_closed: true
      },
      required
    );
  }

  const nearest = results.reduce(
    (best, row) =>
      !best || row.required_shock_pct < best.required_shock_pct
        ? row
        : best,
    null
  );

  return envelope(
    'scenario_forecast',
    {
      case_count: results.length,
      nearest_failure_metric: nearest?.metric || null,
      nearest_failure_shock_pct: nearest?.required_shock_pct ?? null,
      cases: results
    },
    input,
    {
      service_scope: 'reverse_stress_testing',
      method: 'explicit_linear_sensitivity_reverse_solve',
      fail_closed: true
    }
  );
}

function scenarioForecast(input = {}, options = {}) {
  const serviceCode = String(options.serviceCode || '').trim();

  if (serviceCode === 'reverse_stress_testing') {
    return reverseStressAnalysis(input);
  }
  const simulation = new SimulationEngine();
  const simulationResult = simulation.run({
    values: input,
    simulationConfig: input.simulation_config || {}
  });

  const revenue = finite(input.revenue) ?? finite(input.annual_revenue);
  const costs = finite(input.costs) ?? finite(input.annual_costs);
  const growth = finite(input.growth_rate) ?? 0;
  const years = Math.max(1, Math.min(30, Math.round(finite(input.years) || 5)));

  const forecast = [];
  if (revenue !== null || costs !== null) {
    let rev = revenue || 0;
    let cost = costs || 0;
    for (let year = 1; year <= years; year++) {
      rev *= 1 + growth;
      cost *= 1 + (finite(input.cost_growth_rate) ?? growth);
      forecast.push({ year, revenue: rev, costs: cost, operating_result: rev - cost });
    }
  }

  const metrics = {
    forecast,
    simulation: simulationResult.executed ? simulationResult.output : null,
    simulation_status: simulationResult.status,
    simulation_confidence: simulationResult.confidence
  };

  if (!forecast.length && !simulationResult.executed) {
    return envelope(
      'scenario_forecast',
      metrics,
      input,
      {
        service_scope: serviceCode || null,
        simulation_required_inputs: simulationResult.requiredInputs || []
      },
      ['revenue_or_simulation_inputs']
    );
  }

  return envelope('scenario_forecast', metrics, input, {
    service_scope: serviceCode || null,
    simulation_required_inputs: simulationResult.requiredInputs || []
  });
}

module.exports = { scenarioForecast };
