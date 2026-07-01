/**
 * BONDS UCP Bridge for Intelligence Orchestrator
 *
 * Maps semantic form values to UCP inputs, runs UCP, and derives
 * engine-level results without creating a new calculation engine.
 */

const { UniversalCalculationPlatform } = require('../ucp');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Map values collected from the dynamic semantic form to canonical UCP inputs.
 * This is a pilot mapping; future iterations can be driven from registry metadata.
 */
function mapValuesToUcpInputs(values, sector) {
  const v = values || {};
  const revenue = normalizeNumber(v.annual_revenue || v.monthly_revenue || v.revenue || 0);
  const foodCostPct = normalizeNumber(v.food_cost_percentage || 30);
  const laborCost = normalizeNumber(v.labor_cost || 0);
  const rent = normalizeNumber(v.rent || 0);
  const energyCost = normalizeNumber(v.energy_cost || 0);
  const maintenanceCost = normalizeNumber(v.maintenance_cost || 0);
  const operatingExpenses = normalizeNumber(v.operating_expenses || laborCost + rent + energyCost + maintenanceCost);
  const cogs = normalizeNumber(v.cogs || (revenue * foodCostPct / 100));
  const totalAssets = normalizeNumber(v.total_assets || v.asset_value || 0);
  const totalLiabilities = normalizeNumber(v.total_liabilities || v.loan_amount || 0);
  const machineCost = normalizeNumber(v.machine_cost || 0);
  const interestRate = normalizeNumber(v.interest_rate || 0.065);
  const loanTermMonths = normalizeNumber(v.loan_term_months || 60);
  const netProfit = normalizeNumber(v.net_profit || revenue - cogs - operatingExpenses);

  const inputs = {
    revenue,
    cogs,
    operating_expenses: operatingExpenses,
    fixed_costs: rent + maintenanceCost,
    variable_cost_per_unit: normalizeNumber(v.raw_material_cost_per_unit || v.variable_cost_per_unit || 0),
    unit_price: normalizeNumber(v.average_ticket || v.unit_price || 0),
    loan_amount: totalLiabilities,
    asset_value: totalAssets,
    interest_rate: interestRate,
    loan_term_months: loanTermMonths,
    initial_investment: machineCost || totalAssets,
    annual_net_cash_flow: netProfit,
    net_operating_income: netProfit,
    total_debt_service: totalLiabilities,
    transaction_count: normalizeNumber(v.foot_traffic || v.transaction_count || 0),
    labor_cost: laborCost
  };

  if (v.net_profit !== undefined) inputs.net_profit = normalizeNumber(v.net_profit);
  if (sector) inputs.sector_context = sector;
  return inputs;
}

function extractValue(output) {
  if (output === undefined || output === null) return null;
  return typeof output === 'object' ? output.value : output;
}

function deriveEngineResults(ucpResult) {
  const outputs = ucpResult.outputs || {};
  const confidence = Math.round((ucpResult.confidence || 0) * 100);
  const assetValue = extractValue(outputs.asset_value) || extractValue(outputs.net_profit) || 0;
  const dscr = extractValue(outputs.dscr);
  const ltv = extractValue(outputs.ltv);
  const roi = extractValue(outputs.roi);
  const payback = extractValue(outputs.payback_period);
  const netProfit = extractValue(outputs.net_profit) || 0;

  let riskGrade = 'B';
  if ((dscr !== null && dscr < 1.25) || (ltv !== null && ltv > 80)) riskGrade = 'C';
  if ((dscr !== null && dscr < 1) || (ltv !== null && ltv > 90)) riskGrade = 'D';

  return {
    valuation: { value: assetValue, confidence },
    financing: { dscr: dscr || 0, ltv: (ltv || 0) / 100, confidence },
    feasibility: { npv: netProfit, irr: (roi || 0) / 100, payback: payback || 0, confidence },
    risk: { risk_grade: riskGrade, confidence },
    market: { demand_index: confidence, confidence },
    knowledge: { confidence },
    live_data: { confidence: Math.max(30, confidence - 10) },
    simulation: { confidence: Math.max(30, confidence - 5) },
    recommendation: { confidence: Math.max(30, confidence - 5) },
    decision_graph: { confidence },
    evidence: { evidence: ucpResult.evidence, confidence: 80 },
    certificate: { confidence: confidence >= 85 ? 95 : 70 },
    report: { confidence: confidence >= 70 ? 90 : 65 },
    ai: { confidence: Math.max(30, confidence - 10) }
  };
}

function pickResultValue(ucpResult, intent) {
  const outputs = ucpResult.outputs || {};
  const val = (code) => extractValue(outputs[code]) || 0;
  switch (intent) {
    case 'value_asset':
    case 'buy_asset':
    case 'sell_asset':
    case 'revalue':
      return val('asset_value') || val('net_profit');
    case 'request_financing':
      return val('dscr') || val('ltv');
    case 'feasibility':
    case 'investment':
    case 'expansion':
      return val('net_profit') || val('roi');
    case 'market_analysis':
      return val('average_ticket') || ucpResult.confidence * 100;
    case 'risk_analysis':
      return val('dscr') || ucpResult.confidence * 100;
    case 'compare_scenarios':
      return ucpResult.scenarios && ucpResult.scenarios.length ? ucpResult.scenarios : null;
    default:
      return val('net_profit');
  }
}

function createUcpRunner(options = {}) {
  return async function runUcp({ sector, country, city, inputs, intent }) {
    const ucp = await UniversalCalculationPlatform.create({
      preferStatic: true,
      supabase: options.supabase || null
    });

    let resolvedSector = sector;
    const template = ucp.resolveTemplate({ sector, country });
    if (!template) {
      const fallback = ucp.resolveTemplate({ sector: 'company', country });
      resolvedSector = fallback ? 'company' : sector;
    }

    const ucpInputs = mapValuesToUcpInputs(inputs, resolvedSector);
    const ucpResult = await ucp.calculate({
      sector: resolvedSector,
      country,
      inputs: ucpInputs,
      scenarioCodes: ['scn_expected', 'scn_optimistic'],
      requestId: options.requestId,
      userId: options.userId,
      projectId: options.projectId
    });

    return {
      sector: resolvedSector,
      templateCode: ucpResult.templateCode,
      outputs: ucpResult.outputs,
      scenarios: ucpResult.scenarios,
      validation: ucpResult.validation,
      confidence: ucpResult.confidence,
      evidence: ucpResult.evidence,
      trace: ucpResult.trace,
      resultValue: pickResultValue(ucpResult, intent),
      engineResults: deriveEngineResults(ucpResult)
    };
  };
}

module.exports = {
  createUcpRunner,
  mapValuesToUcpInputs,
  deriveEngineResults,
  pickResultValue
};
