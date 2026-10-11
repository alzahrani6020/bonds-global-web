/**
 * BONDS UCP Bridge for Intelligence Orchestrator
 *
 * Maps semantic form values to UCP inputs, runs UCP, and derives
 * engine-level results without creating a new calculation engine.
 *
 * Truth contract:
 * - Computational assumptions remain available to preserve engine capability.
 * - Assumptions/placeholders never count as grounded evidence.
 * - UCP completeness confidence is capped by grounded-input coverage.
 * - Engine facades expose execution/readiness instead of inventing outputs.
 */

const { UniversalCalculationPlatform } = require('../ucp');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function hasValue(v) {
  return v !== undefined && v !== null && v !== '';
}

function firstPresent(source, keys) {
  for (const key of keys) {
    if (hasValue(source[key])) return { key, value: source[key] };
  }
  return null;
}

function buildMappedInputs(values, sector) {
  const v = values || {};
  const inputs = {};
  const provenance = {};

  function set(code, value, kind, detail = null) {
    inputs[code] = value;
    provenance[code] = {
      kind,
      grounded: kind === 'observed' || kind === 'derived_observed',
      detail
    };
  }

  const revenueSource = firstPresent(v, ['annual_revenue', 'monthly_revenue', 'revenue']);
  const revenue = revenueSource ? normalizeNumber(revenueSource.value) : 0;
  set('revenue', revenue, revenueSource ? 'observed' : 'placeholder', revenueSource?.key || 'missing');

  const foodCostSource = firstPresent(v, ['food_cost_percentage']);
  const foodCostPct = foodCostSource ? normalizeNumber(foodCostSource.value) : 30;
  set('food_cost_percentage', foodCostPct, foodCostSource ? 'observed' : 'assumption', foodCostSource?.key || 'default_30_percent');

  const laborSource = firstPresent(v, ['labor_cost']);
  const laborCost = laborSource ? normalizeNumber(laborSource.value) : 0;
  set('labor_cost', laborCost, laborSource ? 'observed' : 'placeholder', laborSource?.key || 'missing');

  const rentSource = firstPresent(v, ['rent']);
  const rent = rentSource ? normalizeNumber(rentSource.value) : 0;
  set('rent', rent, rentSource ? 'observed' : 'placeholder', rentSource?.key || 'missing');

  const energySource = firstPresent(v, ['energy_cost']);
  const energyCost = energySource ? normalizeNumber(energySource.value) : 0;
  set('energy_cost', energyCost, energySource ? 'observed' : 'placeholder', energySource?.key || 'missing');

  const maintenanceSource = firstPresent(v, ['maintenance_cost']);
  const maintenanceCost = maintenanceSource ? normalizeNumber(maintenanceSource.value) : 0;
  set('maintenance_cost', maintenanceCost, maintenanceSource ? 'observed' : 'placeholder', maintenanceSource?.key || 'missing');

  const opexSource = firstPresent(v, ['operating_expenses']);
  const operatingExpenses = opexSource
    ? normalizeNumber(opexSource.value)
    : laborCost + rent + energyCost + maintenanceCost;
  const opexGrounded = Boolean(
    opexSource ||
    [laborSource, rentSource, energySource, maintenanceSource].some(Boolean)
  );
  set(
    'operating_expenses',
    operatingExpenses,
    opexSource ? 'observed' : (opexGrounded ? 'derived_observed' : 'derived_assumption'),
    opexSource?.key || 'sum_operating_components'
  );

  const cogsSource = firstPresent(v, ['cogs']);
  const cogs = cogsSource ? normalizeNumber(cogsSource.value) : (revenue * foodCostPct / 100);
  const cogsGrounded = Boolean(cogsSource || (revenueSource && foodCostSource));
  set(
    'cogs',
    cogs,
    cogsSource ? 'observed' : (cogsGrounded ? 'derived_observed' : 'derived_assumption'),
    cogsSource?.key || 'revenue_x_food_cost_percentage'
  );

  const assetsSource = firstPresent(v, ['total_assets', 'asset_value']);
  const totalAssets = assetsSource ? normalizeNumber(assetsSource.value) : 0;
  set('asset_value', totalAssets, assetsSource ? 'observed' : 'placeholder', assetsSource?.key || 'missing');

  const liabilitiesSource = firstPresent(v, ['total_liabilities', 'loan_amount']);
  const totalLiabilities = liabilitiesSource ? normalizeNumber(liabilitiesSource.value) : 0;
  set('loan_amount', totalLiabilities, liabilitiesSource ? 'observed' : 'placeholder', liabilitiesSource?.key || 'missing');

  const machineSource = firstPresent(v, ['machine_cost']);
  const machineCost = machineSource ? normalizeNumber(machineSource.value) : 0;

  const interestSource = firstPresent(v, ['interest_rate']);
  const interestRate = interestSource ? normalizeNumber(interestSource.value) : 0.065;
  set('interest_rate', interestRate, interestSource ? 'observed' : 'assumption', interestSource?.key || 'default_6_5_percent');

  const termSource = firstPresent(v, ['loan_term_months']);
  const loanTermMonths = termSource ? normalizeNumber(termSource.value) : 60;
  set('loan_term_months', loanTermMonths, termSource ? 'observed' : 'assumption', termSource?.key || 'default_60_months');

  const netProfitSource = firstPresent(v, ['net_profit']);
  const netProfit = netProfitSource
    ? normalizeNumber(netProfitSource.value)
    : revenue - cogs - operatingExpenses;
  const netProfitGrounded = Boolean(
    netProfitSource ||
    (provenance.revenue.grounded && provenance.cogs.grounded && provenance.operating_expenses.grounded)
  );
  set(
    'net_profit',
    netProfit,
    netProfitSource ? 'observed' : (netProfitGrounded ? 'derived_observed' : 'derived_assumption'),
    netProfitSource?.key || 'revenue_minus_cogs_minus_opex'
  );

  const initialInvestment = machineSource ? machineCost : totalAssets;
  set(
    'initial_investment',
    initialInvestment,
    machineSource
      ? 'observed'
      : (provenance.asset_value.grounded ? 'derived_observed' : 'placeholder'),
    machineSource?.key || (assetsSource?.key || 'missing')
  );

  set(
    'fixed_costs',
    rent + maintenanceCost,
    (rentSource || maintenanceSource) ? 'derived_observed' : 'derived_assumption',
    'rent_plus_maintenance'
  );

  const variableCostSource = firstPresent(v, ['raw_material_cost_per_unit', 'variable_cost_per_unit']);
  set(
    'variable_cost_per_unit',
    variableCostSource ? normalizeNumber(variableCostSource.value) : 0,
    variableCostSource ? 'observed' : 'placeholder',
    variableCostSource?.key || 'missing'
  );

  const unitPriceSource = firstPresent(v, ['average_ticket', 'unit_price']);
  set(
    'unit_price',
    unitPriceSource ? normalizeNumber(unitPriceSource.value) : 0,
    unitPriceSource ? 'observed' : 'placeholder',
    unitPriceSource?.key || 'missing'
  );

  set(
    'annual_net_cash_flow',
    netProfit,
    provenance.net_profit.grounded ? 'derived_observed' : 'derived_assumption',
    'net_profit'
  );
  set(
    'net_operating_income',
    netProfit,
    provenance.net_profit.grounded ? 'derived_observed' : 'derived_assumption',
    'net_profit'
  );
  set(
    'total_debt_service',
    totalLiabilities,
    provenance.loan_amount.grounded ? 'derived_observed' : 'placeholder',
    'loan_amount_proxy'
  );

  const txSource = firstPresent(v, ['foot_traffic', 'transaction_count']);
  set(
    'transaction_count',
    txSource ? normalizeNumber(txSource.value) : 0,
    txSource ? 'observed' : 'placeholder',
    txSource?.key || 'missing'
  );

  if (sector) {
    inputs.sector_context = sector;
    provenance.sector_context = { kind: 'context', grounded: true, detail: 'sector' };
  }

  return { inputs, provenance };
}

function mapValuesToUcpInputs(values, sector) {
  return buildMappedInputs(values, sector).inputs;
}

function computeGroundedCoverage(template, ucp, provenance) {
  const inputCodes = template?.schema?.inputs || [];
  if (!inputCodes.length) {
    return {
      score: 1,
      groundedWeight: 0,
      totalWeight: 0,
      syntheticInputs: [],
      requiredSyntheticInputs: []
    };
  }

  let groundedWeight = 0;
  let totalWeight = 0;
  const syntheticInputs = [];
  const requiredSyntheticInputs = [];

  for (const code of inputCodes) {
    const def = ucp.inputs.get(code);
    const required = Boolean(def && def.required);
    const weight = required ? 1 : 0.5;
    totalWeight += weight;

    const p = provenance[code];
    if (p?.grounded) {
      groundedWeight += weight;
    } else {
      const item = {
        code,
        required,
        kind: p?.kind || 'missing',
        detail: p?.detail || null
      };
      syntheticInputs.push(item);
      if (required) requiredSyntheticInputs.push(item);
    }
  }

  return {
    score: totalWeight ? Math.round((groundedWeight / totalWeight) * 100) / 100 : 1,
    groundedWeight,
    totalWeight,
    syntheticInputs,
    requiredSyntheticInputs
  };
}

function extractValue(output) {
  if (output === undefined || output === null) return null;
  return typeof output === 'object' ? output.value : output;
}

function numericOutput(outputs, code) {
  const raw = extractValue(outputs?.[code]);
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function unavailableEngine(capability, details = {}) {
  return {
    status: 'insufficient_inputs',
    capability,
    available: true,
    executed: false,
    decisionEligible: false,
    confidence: null,
    ...details
  };
}

function computedEngine(capability, values, confidence, bridge, details = {}) {
  const assumptionBased = Boolean(
    bridge?.requiredSyntheticInputs?.length ||
    bridge?.validationValid === false
  );

  return {
    ...values,
    status: assumptionBased ? 'assumption_based' : 'computed',
    capability,
    available: true,
    executed: true,
    decisionEligible: !assumptionBased,
    confidence,
    warnings: assumptionBased
      ? [
        ...(bridge?.requiredSyntheticInputs?.length ? ['required_inputs_not_grounded'] : []),
        ...(bridge?.validationValid === false ? ['ucp_validation_failed'] : [])
      ]
      : [],
    ...details
  };
}

function deriveEngineResults(ucpResult) {
  const outputs = ucpResult.outputs || {};
  const confidence = Math.round((ucpResult.confidence || 0) * 100);
  const bridge = ucpResult.bridge || {};

  const assetValue = numericOutput(outputs, 'asset_value');
  const netProfit = numericOutput(outputs, 'net_profit');
  const dscr = numericOutput(outputs, 'dscr');
  const ltvPct = numericOutput(outputs, 'ltv');
  const roiPct = numericOutput(outputs, 'roi');
  const payback = numericOutput(outputs, 'payback_period');

  const valuation = assetValue !== null || netProfit !== null
    ? computedEngine('valuation', { value: assetValue ?? netProfit }, confidence, bridge)
    : unavailableEngine('valuation');

  const financing = dscr !== null || ltvPct !== null
    ? computedEngine('financing', {
      dscr,
      ltv: ltvPct === null ? null : ltvPct / 100
    }, confidence, bridge)
    : unavailableEngine('financing');

  const feasibility = netProfit !== null || roiPct !== null || payback !== null
    ? computedEngine('feasibility', {
      npv: netProfit,
      irr: roiPct === null ? null : roiPct / 100,
      payback
    }, confidence, bridge)
    : unavailableEngine('feasibility');

  let risk = unavailableEngine('risk', { requiredOutputs: ['dscr', 'ltv'] });
  if (dscr !== null || ltvPct !== null) {
    let riskGrade = 'B';
    if ((dscr !== null && dscr < 1.25) || (ltvPct !== null && ltvPct > 80)) riskGrade = 'C';
    if ((dscr !== null && dscr < 1) || (ltvPct !== null && ltvPct > 90)) riskGrade = 'D';
    risk = computedEngine('risk', { risk_grade: riskGrade }, confidence, bridge);
  }

  const evidence = Array.isArray(ucpResult.evidenceList) && ucpResult.evidenceList.length
    ? {
      evidence: ucpResult.evidenceList,
      status: 'computed',
      capability: 'evidence',
      available: true,
      executed: true,
      decisionEligible: true,
      confidence
    }
    : unavailableEngine('evidence');

  return {
    valuation,
    financing,
    feasibility,
    risk,
    market: unavailableEngine('market', { reason: 'no_market_demand_output_from_ucp' }),
    knowledge: unavailableEngine('knowledge', { reason: 'knowledge_engine_not_executed_by_ucp' }),
    live_data: unavailableEngine('live_data', { reason: 'live_data_engine_not_executed_by_ucp' }),
    simulation: unavailableEngine('simulation', { reason: 'simulation_engine_not_executed_by_ucp' }),
    recommendation: unavailableEngine('recommendation', { reason: 'recommendation_engine_not_executed_by_ucp' }),
    decision_graph: unavailableEngine('decision_graph', { reason: 'decision_graph_engine_not_executed_by_ucp' }),
    evidence,
    certificate: unavailableEngine('certificate', { reason: 'certificate_not_generated' }),
    report: unavailableEngine('report', { reason: 'report_not_generated' }),
    ai: unavailableEngine('ai', { reason: 'ai_engine_not_executed_by_ucp' })
  };
}

function pickResultValue(ucpResult, intent) {
  const outputs = ucpResult.outputs || {};
  const val = (code) => {
    const n = numericOutput(outputs, code);
    return n === null ? null : n;
  };

  switch (intent) {
    case 'value_asset':
    case 'buy_asset':
    case 'sell_asset':
    case 'revalue':
      return val('asset_value') ?? val('net_profit');
    case 'request_financing':
      return val('dscr') ?? val('ltv');
    case 'feasibility':
    case 'investment':
    case 'expansion':
      return val('net_profit') ?? val('roi');
    case 'market_analysis':
      return val('average_ticket');
    case 'risk_analysis':
      return val('dscr');
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
    let template = ucp.resolveTemplate({ sector, country });
    if (!template) {
      const fallback = ucp.resolveTemplate({ sector: 'company', country });
      resolvedSector = fallback ? 'company' : sector;
      template = fallback || template;
    }

    const mapped = buildMappedInputs(inputs, resolvedSector);
    const grounded = computeGroundedCoverage(template, ucp, mapped.provenance);

    const ucpResult = await ucp.calculate({
      sector: resolvedSector,
      country,
      inputs: mapped.inputs,
      scenarioCodes: ['scn_expected', 'scn_optimistic'],
      requestId: options.requestId,
      userId: options.userId,
      projectId: options.projectId
    });

    const rawConfidence = Number(ucpResult.confidence) || 0;
    const effectiveConfidence = Math.min(rawConfidence, grounded.score);
    const baseScenario = ucpResult.scenarios?.find(s => s.scenarioType === 'expected') || ucpResult.scenarios?.[0] || null;
    const bridge = {
      groundedCoverage: grounded.score,
      syntheticInputs: grounded.syntheticInputs,
      requiredSyntheticInputs: grounded.requiredSyntheticInputs,
      validationValid: ucpResult.validation?.valid !== false,
      rawUcpConfidence: rawConfidence,
      effectiveConfidence,
      assumptionsUsed: grounded.syntheticInputs.filter(i => i.kind === 'assumption' || i.kind === 'derived_assumption')
    };

    const bridgeResult = {
      ...ucpResult,
      confidence: effectiveConfidence,
      bridge,
      evidenceList: baseScenario?.evidence || []
    };

    return {
      sector: resolvedSector,
      templateCode: ucpResult.templateCode,
      outputs: ucpResult.outputs,
      scenarios: ucpResult.scenarios,
      validation: ucpResult.validation,
      confidence: effectiveConfidence,
      rawConfidence,
      groundedCoverage: grounded.score,
      bridge,
      evidence: ucpResult.evidence,
      trace: ucpResult.trace,
      resultValue: pickResultValue(bridgeResult, intent),
      engineResults: deriveEngineResults(bridgeResult)
    };
  };
}

module.exports = {
  createUcpRunner,
  mapValuesToUcpInputs,
  buildMappedInputs,
  computeGroundedCoverage,
  deriveEngineResults,
  pickResultValue
};
