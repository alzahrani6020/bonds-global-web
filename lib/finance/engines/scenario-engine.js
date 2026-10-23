'use strict';

const { SimulationEngine } = require('../../decision-os/simulation-engine');
const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function scenarioForecast(input = {}) {
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
      { simulation_required_inputs: simulationResult.requiredInputs || [] },
      ['revenue_or_simulation_inputs']
    );
  }

  return envelope('scenario_forecast', metrics, input, {
    simulation_required_inputs: simulationResult.requiredInputs || []
  });
}

module.exports = { scenarioForecast };
