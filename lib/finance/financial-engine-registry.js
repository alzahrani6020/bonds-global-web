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
const { debtScheduleAnalysis } = require('./engines/debt-schedule-engine');
const { covenantAnalysis } = require('./engines/covenant-engine');
const { creditRiskAnalysis } = require('./engines/credit-risk-engine');
const { treasuryLiquidityAnalysis } = require('./engines/treasury-liquidity-engine');

const ENGINES = Object.freeze({
  financial_analysis: financialAnalysis,
  cash_flow_analysis: cashFlowAnalysis,
  funding_readiness: fundingReadiness,
  creditworthiness,
  feasibility: feasibilityAnalysis,
  valuation: valuationAnalysis,
  risk_analysis: riskAnalysis,
  scenario_forecast: scenarioForecast,
  debt_schedule: debtScheduleAnalysis,
  covenant_monitoring: covenantAnalysis,
  credit_risk: creditRiskAnalysis,
  treasury_liquidity: treasuryLiquidityAnalysis
});

const ENGINE_DEFINITIONS = Object.freeze({
  financial_analysis: { deterministic: true, category: 'financial_analysis' },
  cash_flow_analysis: { deterministic: true, category: 'cash_flow' },
  funding_readiness: { deterministic: true, category: 'funding' },
  creditworthiness: { deterministic: true, category: 'credit' },
  feasibility: { deterministic: true, category: 'feasibility' },
  valuation: { deterministic: true, category: 'valuation' },
  risk_analysis: { deterministic: true, category: 'risk' },
  scenario_forecast: { deterministic: true, category: 'scenario' },
  debt_schedule: { deterministic: true, category: 'debt' },
  covenant_monitoring: { deterministic: true, category: 'debt_risk' },
  credit_risk: { deterministic: true, category: 'credit_risk' },
  treasury_liquidity: { deterministic: true, category: 'treasury' }
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

function runCashFlowEngineFromStatement(statement, options = {}) {
  const bridge = require('./accounting/cash-flow-statement-engine');
  return bridge.runCashFlowAnalysisFromStatement(statement, options);
}

module.exports = {
  ENGINE_VERSION,
  ENGINE_DEFINITIONS,
  runFinancialEngine,
  runFinancialEngineFromLedger,
  runCashFlowEngineFromStatement,
  listFinancialEngines,
  helpers: { finite, clamp, safeDiv, npv, irr, paybackPeriod }
};
