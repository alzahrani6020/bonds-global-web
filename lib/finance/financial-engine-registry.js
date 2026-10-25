'use strict';

const { ENGINE_VERSION } = require('./version');
const {
  finite,
  clamp,
  safeDiv,
  npv,
  irr,
  paybackPeriod
} = require('./shared/math');
const { financialAnalysis } = require('./engines/financial-analysis-engine');
const { cashFlowAnalysis } = require('./engines/cash-flow-engine');
const { fundingReadiness, creditworthiness } = require('./engines/funding-engine');
const { feasibilityAnalysis } = require('./engines/feasibility-engine');
const { valuationAnalysis } = require('./engines/valuation-engine');
const { riskAnalysis } = require('./engines/risk-engine');
const { scenarioForecast } = require('./engines/scenario-engine');

const ENGINES = Object.freeze({
  financial_analysis: financialAnalysis,
  cash_flow_analysis: cashFlowAnalysis,
  funding_readiness: fundingReadiness,
  creditworthiness,
  feasibility: feasibilityAnalysis,
  valuation: valuationAnalysis,
  risk_analysis: riskAnalysis,
  scenario_forecast: scenarioForecast
});

const ENGINE_DEFINITIONS = Object.freeze({
  financial_analysis: { deterministic: true, category: 'financial_analysis' },
  cash_flow_analysis: { deterministic: true, category: 'cash_flow' },
  funding_readiness: { deterministic: true, category: 'funding' },
  creditworthiness: { deterministic: true, category: 'credit' },
  feasibility: { deterministic: true, category: 'feasibility' },
  valuation: { deterministic: true, category: 'valuation' },
  risk_analysis: { deterministic: true, category: 'risk' },
  scenario_forecast: { deterministic: true, category: 'scenario' }
});

function runFinancialEngine(engineCode, input = {}, options = {}) {
  const code = String(engineCode || '').trim();
  const engine = ENGINES[code];
  if (!engine) {
    return {
      ok: false,
      executed: false,
      engine_code: code || null,
      status: 'unknown_engine',
      error: { code: 'FINANCIAL_ENGINE_NOT_REGISTERED' },
      available_engines: Object.keys(ENGINES)
    };
  }

  return engine(
    input && typeof input === 'object' && !Array.isArray(input) ? input : {},
    options && typeof options === 'object' && !Array.isArray(options) ? options : {}
  );
}

function listFinancialEngines() {
  return Object.entries(ENGINE_DEFINITIONS).map(([code, definition]) => ({
    code,
    version: ENGINE_VERSION,
    ...definition
  }));
}

function runFinancialEngineFromLedger(options = {}) {
  const bridge = require('./accounting/ledger-analysis-bridge');
  return bridge.runFinancialEngineFromLedger(options);
}

module.exports = {
  ENGINE_VERSION,
  ENGINE_DEFINITIONS,
  runFinancialEngine,
  runFinancialEngineFromLedger,
  listFinancialEngines,
  helpers: { finite, clamp, safeDiv, npv, irr, paybackPeriod }
};
