/**
 * BONDS Enterprise Intelligence — Engine Adapter
 *
 * Wraps every standalone BONDS engine (valuation, risk, opportunity,
 * scenario, recommendation, UCP-derived results) into the canonical
 * Enterprise Intelligence contract:
 *   { output, confidence, evidence[], engine, status, error? }
 */

const RiskEngine = require('../../valuation/risk-intelligence-engine.js');
const ScenarioEngine = require('../../v3/engine/ScenarioEngine.js');
const OpportunityScoringEngine = require('../../v3/engine/OpportunityScoringEngine.js');
const adaptiveRecommendation = require('../../lib/recommendation/adaptive-recommendation.js');
const { BlindSpotEngine } = require('./blind-spot-engine.js');
const { DecisionGraphEngine } = require('./decision-graph-engine.js');
const { RecommendationSynthesizer } = require('./recommendation-synthesizer.js');

let valuationEngineCache = null;

function loadValuationEngine() {
  if (valuationEngineCache) return valuationEngineCache;
  // The frontend valuation engine exposes itself on globalThis when required.
  require('../../valuation/valuation-engine.js');
  valuationEngineCache = globalThis.ValuationEngine || global.ValuationEngine;
  return valuationEngineCache;
}

function safeRound(value, decimals = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(decimals)) : 0;
}

function evidence(source, code, value, confidence, reason = '') {
  return {
    source,
    evidence_type: 'engine_output',
    evidence_code: code,
    value,
    confidence,
    reason,
    timestamp: new Date().toISOString()
  };
}

async function adaptValuationEngine(inputs) {
  const ucp = inputs.ucpResult?.engineResults?.valuation;
  let output;
  let confidence = 50;
  const evs = [];

  if (ucp) {
    output = { value: ucp.value, currency: inputs.currency || 'SAR' };
    confidence = ucp.confidence || confidence;
    evs.push(evidence('ucp', 'valuation_value', output.value, confidence, 'UCP-derived valuation'));
  }

  const assetClass = inputs.assetClass || inputs.asset_class;
  if (assetClass && inputs.valuationInputs) {
    try {
      const ValuationEngine = loadValuationEngine();
      const instance = new ValuationEngine();
      const val = instance.calculate(assetClass, inputs.valuationInputs);
      if (val && typeof val === 'object') {
        output = {
          value: val.fairValue || val.marketValue || val.bookValue || 0,
          bookValue: val.bookValue,
          marketValue: val.marketValue,
          fairValue: val.fairValue,
          investmentValue: val.investmentValue,
          liquidationValue: val.liquidationValue,
          currency: inputs.currency || 'SAR'
        };
        confidence = Math.min(95, 60 + (val.qualityScore || 0) * 0.35);
        evs.push(evidence('valuation_engine', 'valuation_full', val, confidence, 'Standalone valuation engine'));
      }
    } catch (err) {
      return { output, confidence, evidence: evs, engine: 'valuation', status: 'partial', error: err.message };
    }
  }

  if (!output) {
    output = { value: inputs.market_value || inputs.asset_value || 0, currency: inputs.currency || 'SAR' };
    evs.push(evidence('input', 'valuation_fallback', output.value, 40, 'Fallback to provided market value'));
  }

  return { output, confidence, evidence: evs, engine: 'valuation', status: 'ok' };
}

async function adaptRiskEngine(inputs) {
  const ucp = inputs.ucpResult?.engineResults?.risk;
  let output;
  let confidence = 50;
  const evs = [];

  if (ucp) {
    output = { riskGrade: ucp.risk_grade, riskIndex: gradeToIndex(ucp.risk_grade) };
    confidence = ucp.confidence || confidence;
    evs.push(evidence('ucp', 'risk_grade', output.riskGrade, confidence, 'UCP-derived risk grade'));
  }

  if (inputs.assetClass || inputs.asset_class) {
    try {
      const result = RiskEngine.calculate(
        inputs.assetClass || inputs.asset_class,
        inputs.riskAnswers || {},
        { externalData: inputs.riskExternalData }
      );
      output = {
        riskIndex: result.riskIndex,
        riskGrade: result.riskGrade,
        riskLevel: result.riskLevel,
        categoryScores: result.categoryScores,
        criticalRisks: (result.criticalRisks || []).slice(0, 5),
        mitigations: (result.mitigations || []).slice(0, 3)
      };
      confidence = result.success !== false ? (result.confidenceScore || 60) : 30;
      evs.push(evidence('risk_intelligence_engine', 'risk_full', output, confidence, 'Standalone risk engine'));
    } catch (err) {
      return { output, confidence, evidence: evs, engine: 'risk', status: 'partial', error: err.message };
    }
  }

  if (!output) {
    output = { riskGrade: 'C', riskIndex: 50 };
    evs.push(evidence('input', 'risk_fallback', output.riskGrade, 30, 'No risk inputs available'));
  }

  return { output, confidence, evidence: evs, engine: 'risk', status: 'ok' };
}

function gradeToIndex(grade) {
  const map = { A: 15, B: 35, C: 55, D: 75, E: 90 };
  return map[grade] || 50;
}

async function adaptOpportunityEngine(inputs) {
  const { cityId, activityId, year, supabase } = inputs;
  if (cityId && activityId && year && supabase) {
    try {
      const engine = new OpportunityScoringEngine(supabase);
      const result = await engine.calculateAndSave({ cityId, activityId, year });
      if (result) {
        return {
          output: {
            score: result.score,
            class: result.class,
            breakdown: result.breakdown
          },
          confidence: 80,
          evidence: [evidence('opportunity_engine', 'opportunity_score', result.score, 80, 'City/activity opportunity score')],
          engine: 'opportunity',
          status: 'ok'
        };
      }
    } catch (err) {
      return {
        output: { score: 0 },
        confidence: 30,
        evidence: [evidence('opportunity_engine', 'opportunity_error', null, 30, err.message)],
        engine: 'opportunity',
        status: 'error',
        error: err.message
      };
    }
  }

  const fallbackScore = inputs.opportunityScore || inputs.market_opportunity || 50;
  return {
    output: { score: fallbackScore, class: scoreClass(fallbackScore) },
    confidence: 40,
    evidence: [evidence('input', 'opportunity_fallback', fallbackScore, 40, 'No supabase context; fallback score')],
    engine: 'opportunity',
    status: 'partial'
  };
}

function scoreClass(score) {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'weak';
}

async function adaptScenarioEngine(inputs) {
  const ucpScenarios = inputs.ucpResult?.scenarios;
  if (ucpScenarios && ucpScenarios.length) {
    return {
      output: { scenarios: ucpScenarios },
      confidence: Math.round((inputs.ucpResult.confidence || 0.5) * 100),
      evidence: [evidence('ucp', 'ucp_scenarios', ucpScenarios.length, 80, 'UCP scenario outputs')],
      engine: 'scenario',
      status: 'ok'
    };
  }

  if (inputs.modelData && inputs.scenarios) {
    try {
      const result = ScenarioEngine.runScenarios(
        inputs.modelData,
        inputs.baseOptions || {},
        inputs.scenarios
      );
      return {
        output: result,
        confidence: 75,
        evidence: [evidence('scenario_engine', 'scenario_full', result.baseline?.summary, 75, 'Standalone scenario engine')],
        engine: 'scenario',
        status: 'ok'
      };
    } catch (err) {
      return { output: null, confidence: 30, evidence: [], engine: 'scenario', status: 'error', error: err.message };
    }
  }

  return {
    output: { scenarios: [] },
    confidence: 30,
    evidence: [evidence('input', 'scenario_fallback', null, 30, 'No scenario inputs')],
    engine: 'scenario',
    status: 'partial'
  };
}

async function adaptRecommendationEngine(inputs) {
  try {
    const result = adaptiveRecommendation.generateRecommendations({
      sector: inputs.sector,
      country: inputs.country,
      assetType: inputs.assetType || inputs.asset_class,
      decisionType: inputs.decisionType || inputs.intent,
      liveData: inputs.liveData || buildLiveData(inputs),
      decisionProfile: inputs.decisionProfile,
      contextMemory: inputs.contextMemory,
      language: inputs.language || 'ar'
    });

    return {
      output: {
        recommendations: result.recommendations,
        top: result.recommendations[0] || null
      },
      confidence: result.recommendations.length
        ? safeRound(result.recommendations[0].confidence, 1)
        : 50,
      evidence: (result.recommendations || []).slice(0, 3).map((r, i) =>
        evidence('adaptive_recommendation', `rec_${i}`, r.title, r.confidence, r.action)
      ),
      engine: 'recommendation',
      status: 'ok'
    };
  } catch (err) {
    return { output: null, confidence: 30, evidence: [], engine: 'recommendation', status: 'error', error: err.message };
  }
}

function buildLiveData(inputs) {
  const ucp = inputs.ucpResult;
  return {
    valuation: ucp?.engineResults?.valuation?.value,
    riskGrade: ucp?.engineResults?.risk?.risk_grade,
    dscr: ucp?.engineResults?.financing?.dscr,
    npv: ucp?.engineResults?.feasibility?.npv,
    opportunityScore: inputs.opportunityScore,
    ...inputs.liveData
  };
}

async function adaptUcpDerivedEngine(engineCode, inputs) {
  const ucp = inputs.ucpResult?.engineResults?.[engineCode];
  if (ucp) {
    return {
      output: ucp,
      confidence: ucp.confidence || 50,
      evidence: [evidence('ucp', engineCode, ucp, ucp.confidence || 50, `UCP ${engineCode} engine result`)],
      engine: engineCode,
      status: 'ok'
    };
  }

  const fallback = {
    feasibility: { npv: 0, irr: 0, payback: 0, confidence: 50 },
    financing: { dscr: 1.2, ltv: 0.7, confidence: 50 },
    market: { demand_index: 50, confidence: 50 }
  }[engineCode] || { confidence: 50 };

  return {
    output: fallback,
    confidence: fallback.confidence,
    evidence: [evidence('input', `${engineCode}_fallback`, fallback, fallback.confidence, 'No UCP result available')],
    engine: engineCode,
    status: 'partial'
  };
}

async function adaptBlindSpotEngine(inputs) {
  const engine = new BlindSpotEngine(inputs);
  return engine.analyze();
}

async function adaptDecisionGraphEngine(inputs) {
  const engine = new DecisionGraphEngine(inputs);
  return engine.build();
}

async function adaptRecommendationSynthesizer(inputs) {
  const engine = new RecommendationSynthesizer(inputs);
  return engine.synthesize();
}

const adapters = {
  valuation: adaptValuationEngine,
  risk: adaptRiskEngine,
  opportunity: adaptOpportunityEngine,
  scenario: adaptScenarioEngine,
  recommendation: adaptRecommendationEngine,
  feasibility: (inputs) => adaptUcpDerivedEngine('feasibility', inputs),
  financing: (inputs) => adaptUcpDerivedEngine('financing', inputs),
  market: (inputs) => adaptUcpDerivedEngine('market', inputs),
  blind_spot: adaptBlindSpotEngine,
  decision_graph: adaptDecisionGraphEngine,
  recommendation_synthesizer: adaptRecommendationSynthesizer
};

async function adapt(engineCode, inputs) {
  const adapter = adapters[engineCode];
  if (!adapter) throw new Error(`No adapter for engine ${engineCode}`);
  const result = await adapter(inputs);
  return { ...result, engine: engineCode };
}

module.exports = { adapt, adapters, loadValuationEngine };
