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
const { LiveMarketIntelligenceEngine } = require('../decision-os/live-market-intelligence-engine.js');
const { SimulationEngine } = require('../decision-os/simulation-engine.js');
const { SectorDigitalTwinRegistry } = require('../decision-os/sector-digital-twin-registry.js');
const { DecisionRecommendationEngine } = require('../decision-os/decision-recommendation-engine.js');
const { EvidenceGraphEngine } = require('../decision-os/evidence-graph-engine.js');
const { DecisionMemoryEngine } = require('../decision-os/decision-memory-engine.js');

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
    const suppliedValue = Number(inputs.market_value ?? inputs.asset_value);
    if (Number.isFinite(suppliedValue)) {
      output = { value: suppliedValue, currency: inputs.currency || 'SAR' };
      confidence = 60;
      evs.push(evidence('input', 'valuation_user_supplied', output.value, confidence, 'User-supplied market/asset value'));
    } else {
      return {
        output: null,
        confidence: 0,
        evidence: evs,
        engine: 'valuation',
        status: 'insufficient_inputs',
        executed: false,
        decisionEligible: false
      };
    }
  }

  return { output, confidence, evidence: evs, engine: 'valuation', status: 'ok', executed: true, decisionEligible: true };
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
    return {
      output: null,
      confidence: 0,
      evidence: evs,
      engine: 'risk',
      status: 'insufficient_inputs',
      executed: false,
      decisionEligible: false
    };
  }

  return { output, confidence, evidence: evs, engine: 'risk', status: 'ok', executed: true, decisionEligible: true };
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

  const suppliedScore = Number(inputs.opportunityScore ?? inputs.market_opportunity);
  if (Number.isFinite(suppliedScore)) {
    return {
      output: { score: suppliedScore, class: scoreClass(suppliedScore) },
      confidence: 50,
      evidence: [evidence('input', 'opportunity_user_supplied', suppliedScore, 50, 'Explicitly supplied opportunity score')],
      engine: 'opportunity',
      status: 'user_supplied',
      executed: true,
      decisionEligible: false
    };
  }

  return {
    output: null,
    confidence: 0,
    evidence: [],
    engine: 'opportunity',
    status: 'insufficient_inputs',
    executed: false,
    decisionEligible: false
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
    confidence: 0,
    evidence: [],
    engine: 'scenario',
    status: 'insufficient_inputs',
    executed: false,
    decisionEligible: false
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
  if (ucp && ucp.executed === true) {
    return {
      output: ucp,
      confidence: Number.isFinite(Number(ucp.confidence)) ? Number(ucp.confidence) : 0,
      evidence: [evidence('ucp', engineCode, ucp, Number(ucp.confidence) || 0, `UCP ${engineCode} engine result`)],
      engine: engineCode,
      status: ucp.status || 'computed',
      executed: true,
      decisionEligible: ucp.decisionEligible !== false
    };
  }

  return {
    output: ucp || null,
    confidence: 0,
    evidence: [],
    engine: engineCode,
    status: 'insufficient_inputs',
    executed: false,
    decisionEligible: false,
    reason: ucp?.reason || `${engineCode}_not_executed`
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

async function loadExistingMarketRecords(inputs) {
  const records = Array.isArray(inputs.liveDataRecords) ? [...inputs.liveDataRecords] : [];

  if (inputs.liveData && typeof inputs.liveData === 'object') {
    for (const [code, raw] of Object.entries(inputs.liveData)) {
      if (raw && typeof raw === 'object' && 'value' in raw) {
        records.push({ code, ...raw });
      } else if (typeof raw === 'number') {
        records.push({
          code,
          value: raw,
          source: 'request_live_data',
          sourceType: 'USER_PROVIDED',
          confidence: 70,
          observedAt: inputs.liveDataObservedAt || null
        });
      }
    }
  }

  if (!inputs.supabase) return records;

  // Primary live/historical source: normalized metrics produced by the existing
  // Data Acquisition Pipeline. This preserves all current adapters and avoids a
  // second competing source of truth.
  if (inputs.cityId) {
    try {
      let metricQuery = inputs.supabase
        .from('normalized_metrics')
        .select('metric_code, value, value_text, source_id, source_name, confidence, fetched_at, year, metadata')
        .eq('city_id', inputs.cityId);

      if (inputs.activityId) metricQuery = metricQuery.eq('activity_id', inputs.activityId);
      if (inputs.year) metricQuery = metricQuery.eq('year', inputs.year);

      const { data: normalized, error: normalizedError } = await metricQuery
        .order('fetched_at', { ascending: false })
        .limit(500);

      if (!normalizedError) {
        for (const metric of normalized || []) {
          const source = metric.source_name || metric.source_id || 'normalized_metrics';
          records.push({
            code: metric.metric_code,
            value: metric.value ?? metric.value_text,
            source,
            sourceType: /gastat|sama|official|government|ministry|planning|capmas|statistics/i.test(String(source))
              ? 'OFFICIAL_OBSERVED'
              : (/infer|regression|llm/i.test(String(metric.source_id || source))
                ? 'INFERRED'
                : 'HISTORICAL_DATABASE'),
            observedAt: metric.fetched_at || null,
            confidence: metric.confidence,
            isEstimated: /infer|regression|llm|benchmark/i.test(String(metric.source_id || source)),
            country: inputs.country,
            city: inputs.city,
            activity: inputs.activity,
            metadata: {
              sourceId: metric.source_id,
              year: metric.year,
              ...(metric.metadata || {})
            }
          });
        }
      }
    } catch (err) {
      records.push({
        code: '_normalized_metrics_error',
        value: null,
        source: 'normalized_metrics',
        sourceType: 'UNKNOWN',
        confidence: 0,
        metadata: { error: err.message }
      });
    }
  }

  // Existing market_data remains available as an additional legacy/asset-class
  // source. It augments, rather than replaces, normalized metrics.
  const assetClass = inputs.assetClass || inputs.asset_class;
  if (assetClass) {
    try {
      let query = inputs.supabase
        .from('market_data')
        .select('*')
        .eq('asset_class', assetClass);

      if (inputs.country) query = query.eq('country', inputs.country);
      if (inputs.city) query = query.eq('city', inputs.city);

      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const mapping = {
          average_selling_price: 'average_selling_price',
          average_buying_price: 'average_buying_price',
          transaction_count: 'transaction_count',
          supply_index: 'supply_index',
          demand_index: 'demand_index',
          competitor_count: 'competitor_count',
          average_sale_speed_days: 'average_sale_speed_days',
          inflation_rate: 'inflation_rate',
          interest_rate: 'interest_rate',
          economic_growth_rate: 'economic_growth_rate'
        };
        for (const [field, code] of Object.entries(mapping)) {
          if (data[field] === null || data[field] === undefined) continue;
          records.push({
            code,
            value: data[field],
            source: data.source || 'market_data',
            sourceType: /government|official|ministry|sama|gastat/i.test(String(data.source || ''))
              ? 'OFFICIAL_OBSERVED'
              : 'HISTORICAL_DATABASE',
            observedAt: data.updated_at || data.recorded_at || null,
            confidence: 80,
            country: data.country || inputs.country,
            city: data.city || inputs.city
          });
        }
      }
    } catch (err) {
      records.push({
        code: '_market_provider_error',
        value: null,
        source: 'market_data',
        sourceType: 'UNKNOWN',
        confidence: 0,
        metadata: { error: err.message }
      });
    }
  }

  return records;
}

async function adaptLiveMarketEngine(inputs) {
  const records = await loadExistingMarketRecords(inputs);
  const engine = new LiveMarketIntelligenceEngine();
  return engine.analyze({ ...inputs, liveDataRecords: records });
}

async function adaptSimulationEngine(inputs) {
  const engine = new SimulationEngine();
  return engine.run(inputs);
}

async function adaptSectorDigitalTwin(inputs) {
  const registry = new SectorDigitalTwinRegistry(inputs.sectorDigitalTwins || {});
  const values = { ...(inputs.values || {}), ...(inputs.inputs || {}) };
  const ucpInputs = inputs.ucpResult?.bridge?.provenance ? (inputs.ucpResult?.inputs || {}) : {};
  return registry.evaluate(inputs.sector || 'generic', { ...ucpInputs, ...values });
}

function deriveDecisionIntegrity(inputs) {
  if (inputs.decisionIntegrity) return inputs.decisionIntegrity;
  const ucp = inputs.ucpResult;
  if (!ucp) return { status: 'review_required', groundedCoverage: 0 };
  const groundedCoverage = Math.round((ucp.groundedCoverage || 0) * 100);
  const requiredSynthetic = ucp.bridge?.requiredSyntheticInputs || [];
  return {
    status: ucp.validation?.valid === false || requiredSynthetic.length
      ? 'blocked'
      : (groundedCoverage < 70 ? 'review_required' : 'decision_ready'),
    groundedCoverage,
    requiredSyntheticInputs: requiredSynthetic
  };
}

async function adaptDecisionRecommendationEngine(inputs) {
  const engine = new DecisionRecommendationEngine();
  return engine.decide({
    ...inputs,
    confidence: inputs.aggregateConfidence ?? inputs.confidence ?? Math.round((inputs.ucpResult?.confidence || 0) * 100),
    decisionIntegrity: deriveDecisionIntegrity(inputs),
    simulation: inputs.engineResults?.simulation,
    engineResults: inputs.engineResults || {}
  });
}

async function adaptEvidenceGraphEngine(inputs) {
  const engine = new EvidenceGraphEngine();
  return engine.build({
    ...inputs,
    decision: inputs.engineResults?.decision_recommendation?.output || null,
    inputEvidence: inputs.inputEvidence || inputs.evidence || []
  });
}

async function adaptDecisionMemoryEngine(inputs) {
  const decision = inputs.engineResults?.decision_recommendation?.output;
  if (!decision) {
    return {
      output: null,
      confidence: 0,
      evidence: [],
      engine: 'decision_memory',
      status: 'insufficient_inputs',
      executed: false,
      decisionEligible: false
    };
  }

  const memory = new DecisionMemoryEngine({ supabase: inputs.supabase || null });
  const simulation = inputs.engineResults?.simulation?.output || {};
  const feasibility = inputs.engineResults?.feasibility?.output || inputs.engineResults?.feasibility || {};
  const financing = inputs.engineResults?.financing?.output || inputs.engineResults?.financing || {};
  const expectedOutcome = {
    expected_npv: simulation.expectedNpv ?? feasibility.npv ?? null,
    probability_positive_npv: simulation.probabilityPositiveNpv ?? null,
    expected_dscr: financing.dscr ?? null
  };

  if (inputs.persist === false || !inputs.projectId || !inputs.userId) {
    const reason = inputs.persist === false
      ? 'persistence_disabled'
      : (!inputs.projectId ? 'project_id_required' : 'user_id_required');
    return {
      output: {
        status: 'not_persisted',
        reason,
        expectedOutcome
      },
      confidence: Number(inputs.confidence || 0),
      evidence: [],
      engine: 'decision_memory',
      status: 'not_persisted',
      executed: false,
      decisionEligible: true
    };
  }

  const result = await memory.recordDecision({
    projectId: inputs.projectId,
    entityId: inputs.projectId,
    decision: decision.primary,
    inputs: inputs.values || inputs.inputs || {},
    expectedOutcome,
    confidence: inputs.confidence ?? decision.decisionScore,
    userId: inputs.userId
  });

  return {
    output: result,
    confidence: Number(inputs.confidence || 0),
    evidence: result.status === 'persisted' ? [{
      source: 'decision_memory',
      evidence_type: 'decision_record',
      evidence_code: 'decision_memory_record',
      value: result.record?.id || null,
      confidence: Number(inputs.confidence || 0),
      timestamp: new Date().toISOString()
    }] : [],
    engine: 'decision_memory',
    status: result.status,
    executed: result.executed,
    decisionEligible: true
  };
}

const adapters = {
  live_market: adaptLiveMarketEngine,
  sector_digital_twin: adaptSectorDigitalTwin,
  valuation: adaptValuationEngine,
  risk: adaptRiskEngine,
  opportunity: adaptOpportunityEngine,
  scenario: adaptScenarioEngine,
  simulation: adaptSimulationEngine,
  recommendation: adaptRecommendationEngine,
  feasibility: (inputs) => adaptUcpDerivedEngine('feasibility', inputs),
  financing: (inputs) => adaptUcpDerivedEngine('financing', inputs),
  market: (inputs) => adaptUcpDerivedEngine('market', inputs),
  blind_spot: adaptBlindSpotEngine,
  decision_graph: adaptDecisionGraphEngine,
  recommendation_synthesizer: adaptRecommendationSynthesizer,
  decision_recommendation: adaptDecisionRecommendationEngine,
  evidence_graph: adaptEvidenceGraphEngine,
  decision_memory: adaptDecisionMemoryEngine
};

async function adapt(engineCode, inputs) {
  const adapter = adapters[engineCode];
  if (!adapter) throw new Error(`No adapter for engine ${engineCode}`);
  const result = await adapter(inputs);
  return { ...result, engine: engineCode };
}

module.exports = { adapt, adapters, loadValuationEngine };
