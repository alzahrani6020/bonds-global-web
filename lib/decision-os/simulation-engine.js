'use strict';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(seed = 1) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalSample(random) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function npv(initialInvestment, annualCashFlow, discountRate, years) {
  let result = -initialInvestment;
  for (let year = 1; year <= years; year++) {
    result += annualCashFlow / Math.pow(1 + discountRate, year);
  }
  return result;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class SimulationEngine {
  run(context = {}) {
    const values = context.values || context.inputs || {};
    const outputs = context.ucpResult?.outputs || {};

    const initialInvestment =
      finite(values.initial_investment) ??
      finite(values.total_assets) ??
      finite(values.asset_value) ??
      finite(outputs.initial_investment?.value ?? outputs.initial_investment) ??
      finite(outputs.asset_value?.value ?? outputs.asset_value);

    const baseRevenue =
      finite(values.annual_revenue) ??
      finite(values.revenue) ??
      finite(outputs.revenue?.value ?? outputs.revenue);

    const baseCashFlow =
      finite(values.annual_net_cash_flow) ??
      finite(values.net_profit) ??
      finite(outputs.annual_net_cash_flow?.value ?? outputs.annual_net_cash_flow) ??
      finite(outputs.net_profit?.value ?? outputs.net_profit);

    if (initialInvestment === null || initialInvestment <= 0 || baseCashFlow === null) {
      return {
        output: null,
        confidence: 0,
        evidence: [],
        engine: 'simulation',
        status: 'insufficient_inputs',
        executed: false,
        decisionEligible: false,
        requiredInputs: ['initial_investment_or_asset_value', 'annual_net_cash_flow_or_net_profit']
      };
    }

    const config = context.simulationConfig || {};
    const iterations = clamp(Math.round(finite(config.iterations) ?? 5000), 100, 50000);
    const years = clamp(Math.round(finite(config.years) ?? 5), 1, 30);
    const discountRate = clamp(finite(config.discountRate) ?? finite(values.discount_rate) ?? 0.10, -0.5, 1);
    const revenueVolatility = clamp(finite(config.revenueVolatility) ?? 0.15, 0, 1);
    const costVolatility = clamp(finite(config.costVolatility) ?? 0.10, 0, 1);
    const shockCorrelation = clamp(finite(config.shockCorrelation) ?? 0.35, -1, 1);
    const debtService = finite(values.total_debt_service) ?? finite(outputs.total_debt_service?.value ?? outputs.total_debt_service);
    const seed = finite(config.seed) ?? 20261012;
    const random = seededRandom(seed);

    const results = [];
    let positiveNpv = 0;
    let lossCount = 0;
    let dscrBelowOne = 0;

    const margin = baseRevenue && baseRevenue !== 0 ? baseCashFlow / baseRevenue : null;

    for (let i = 0; i < iterations; i++) {
      const z1 = normalSample(random);
      const z2 = normalSample(random);
      const revenueShock = z1 * revenueVolatility;
      const correlatedCostShock =
        (shockCorrelation * z1 + Math.sqrt(Math.max(0, 1 - shockCorrelation ** 2)) * z2) * costVolatility;

      const simulatedRevenue = baseRevenue === null
        ? null
        : Math.max(0, baseRevenue * (1 + revenueShock));

      const revenueDrivenCash = simulatedRevenue !== null && margin !== null
        ? simulatedRevenue * margin
        : baseCashFlow * (1 + revenueShock);

      const simulatedCashFlow = revenueDrivenCash * (1 - correlatedCostShock);
      const simulatedNpv = npv(initialInvestment, simulatedCashFlow, discountRate, years);
      const simulatedDscr = debtService && debtService > 0 ? simulatedCashFlow / debtService : null;

      results.push({ npv: simulatedNpv, cashFlow: simulatedCashFlow, dscr: simulatedDscr });
      if (simulatedNpv > 0) positiveNpv++;
      if (simulatedCashFlow < 0) lossCount++;
      if (simulatedDscr !== null && simulatedDscr < 1) dscrBelowOne++;
    }

    const npvs = results.map(result => result.npv).sort((a, b) => a - b);
    const cashFlows = results.map(result => result.cashFlow).sort((a, b) => a - b);

    const expectedNpv = npvs.reduce((sum, value) => sum + value, 0) / npvs.length;
    const expectedCashFlow = cashFlows.reduce((sum, value) => sum + value, 0) / cashFlows.length;
    const probabilityPositiveNpv = positiveNpv / iterations;
    const probabilityLoss = lossCount / iterations;
    const probabilityDscrBelowOne = debtService && debtService > 0 ? dscrBelowOne / iterations : null;

    const stressCases = {
      demandDown20: npv(initialInvestment, baseCashFlow * 0.8, discountRate, years),
      costUp15: npv(initialInvestment, baseCashFlow * 0.85, discountRate, years),
      combinedDownside: npv(initialInvestment, baseCashFlow * 0.65, Math.min(1, discountRate + 0.03), years),
      upside: npv(initialInvestment, baseCashFlow * 1.20, Math.max(-0.5, discountRate - 0.01), years)
    };

    const sensitivity = {
      annual_cash_flow: {
        minus_10_pct: npv(initialInvestment, baseCashFlow * 0.90, discountRate, years),
        base: npv(initialInvestment, baseCashFlow, discountRate, years),
        plus_10_pct: npv(initialInvestment, baseCashFlow * 1.10, discountRate, years)
      },
      discount_rate: {
        minus_200_bps: npv(initialInvestment, baseCashFlow, Math.max(-0.5, discountRate - 0.02), years),
        base: npv(initialInvestment, baseCashFlow, discountRate, years),
        plus_200_bps: npv(initialInvestment, baseCashFlow, Math.min(1, discountRate + 0.02), years)
      }
    };

    const confidence = Math.round(clamp(
      (context.ucpResult?.confidence || 0) * 100 * 0.7 +
      Math.min(100, iterations / 50) * 0.3,
      0,
      100
    ));

    return {
      output: {
        method: 'monte_carlo',
        iterations,
        seed,
        assumptions: { years, discountRate, revenueVolatility, costVolatility, shockCorrelation },
        expectedNpv,
        expectedCashFlow,
        probabilityPositiveNpv,
        probabilityLoss,
        probabilityDscrBelowOne,
        percentiles: {
          npv: { p05: percentile(npvs, 0.05), p50: percentile(npvs, 0.50), p95: percentile(npvs, 0.95) },
          cashFlow: { p05: percentile(cashFlows, 0.05), p50: percentile(cashFlows, 0.50), p95: percentile(cashFlows, 0.95) }
        },
        stressCases,
        sensitivity
      },
      confidence,
      evidence: [{
        source: 'simulation_engine',
        evidence_type: 'simulation',
        evidence_code: 'monte_carlo_summary',
        value: { expectedNpv, probabilityPositiveNpv, probabilityLoss },
        confidence,
        timestamp: new Date().toISOString(),
        metadata: { iterations, seed, years, discountRate }
      }],
      engine: 'simulation',
      status: 'computed',
      executed: true,
      decisionEligible: confidence >= 45
    };
  }
}

module.exports = { SimulationEngine, seededRandom, normalSample, percentile, npv };
