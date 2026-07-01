/**
 * BONDS Enterprise Intelligence — Unified Runner
 *
 * Resolves which engines should run for a given intent, runs the UCP-backed
 * calculation once when needed, executes each engine through the canonical
 * adapter, and aggregates evidence/confidence into a single enterprise result.
 */

const { createUcpRunner } = require('../orchestrator/ucp-bridge');
const {
  TrustedDataFabric,
  ConnectorRegistry,
  SourceRegistry,
  DatabaseConnector,
  ManualConnector
} = require('../fabric');
const { EnterpriseIntelligenceRegistry } = require('./registry');
const { adapt } = require('./engine-adapter');

function createDefaultRegistry() {
  const registry = new EnterpriseIntelligenceRegistry();
  registry.register('valuation', null, {
    name: 'Valuation Engine',
    description: 'Asset valuation via standalone engine or UCP.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 2
  });
  registry.register('risk', null, {
    name: 'Risk Intelligence Engine',
    description: 'Multi-dimensional risk scoring and adjustments.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 2
  });
  registry.register('opportunity', null, {
    name: 'Opportunity Scoring Engine',
    description: 'City/activity opportunity scoring.',
    category: 'analysis',
    requiresUcp: false,
    confidenceWeight: 1
  });
  registry.register('scenario', null, {
    name: 'Scenario Engine',
    description: 'Sensitivity and scenario analysis.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 1
  });
  registry.register('recommendation', null, {
    name: 'Adaptive Recommendation Engine',
    description: 'Rule-based adaptive recommendations.',
    category: 'recommendation',
    requiresUcp: false,
    confidenceWeight: 1
  });
  registry.register('feasibility', null, {
    name: 'Feasibility Engine',
    description: 'NPV/IRR/payback feasibility metrics from UCP.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 1
  });
  registry.register('financing', null, {
    name: 'Financing Engine',
    description: 'DSCR/LTV financing metrics from UCP.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 1
  });
  registry.register('market', null, {
    name: 'Market Engine',
    description: 'Market demand index from UCP.',
    category: 'analysis',
    requiresUcp: true,
    confidenceWeight: 1
  });
  registry.register('blind_spot', null, {
    name: 'Blind Spot Engine',
    description: 'Detects missing engines, contradictions, and low-confidence signals.',
    category: 'meta',
    requiresUcp: false,
    isPostProcessor: true,
    confidenceWeight: 1
  });
  registry.register('decision_graph', null, {
    name: 'Decision Graph Engine',
    description: 'Builds decision graph, critical path, and next action.',
    category: 'meta',
    requiresUcp: false,
    isPostProcessor: true,
    confidenceWeight: 1
  });
  registry.register('recommendation_synthesizer', null, {
    name: 'Recommendation Synthesizer',
    description: 'Combines all engines into ranked actions.',
    category: 'meta',
    requiresUcp: false,
    isPostProcessor: true,
    confidenceWeight: 1
  });
  return registry;
}

function createFabric() {
  const hasSupabaseEnv = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabase = null;
  let sourceRegistry = null;
  const registry = new ConnectorRegistry();

  if (hasSupabaseEnv) {
    try {
      const { getSupabaseClient } = require('../../v3/lib/supabase');
      supabase = getSupabaseClient();
      sourceRegistry = new SourceRegistry(supabase);
    } catch (err) {
      // Supabase not available in this environment.
    }
  }

  registry.register(new DatabaseConnector({ supabase, sourceCode: 'database_metrics', sourceName: 'Normalized Metrics DB' }));
  registry.register(new ManualConnector({ supabase, sourceCode: 'manual', sourceName: 'Manual Override' }));

  return new TrustedDataFabric({ supabase, connectorRegistry: registry, sourceRegistry });
}

function normalizeEvidence(engineCode, rawEvidence) {
  if (!Array.isArray(rawEvidence)) rawEvidence = [];
  return rawEvidence.map(e => ({
    engine: engineCode,
    source: e.source || engineCode,
    evidence_type: e.evidence_type || 'engine_output',
    evidence_code: e.evidence_code || e.code || engineCode,
    value: e.value,
    confidence: typeof e.confidence === 'number' ? e.confidence : 50,
    reason: e.reason || e.message || '',
    timestamp: e.timestamp || new Date().toISOString(),
    metadata: e.metadata || null
  }));
}

function aggregateConfidence(engineResults, registry) {
  const entries = Object.entries(engineResults).filter(([code]) => !['blind_spot', 'decision_graph'].includes(code));
  if (entries.length === 0) return 50;

  let totalWeight = 0;
  let weightedSum = 0;
  for (const [code, result] of entries) {
    const meta = registry.getMetadata(code);
    const weight = meta?.confidenceWeight || 1;
    const conf = result?.confidence || 50;
    weightedSum += conf * weight;
    totalWeight += weight;
  }
  return totalWeight ? Math.round(weightedSum / totalWeight) : 50;
}

async function run(request) {
  const registry = request.registry || createDefaultRegistry();
  const fabric = request.fabric || (request.skipFabric ? null : createFabric());
  const engineCodes = registry.resolveEngines(request);

  const mainEngines = engineCodes.filter(code => !registry.getMetadata(code)?.isPostProcessor);
  const postProcessors = engineCodes.filter(code => registry.getMetadata(code)?.isPostProcessor);

  const needsUcp = mainEngines.some(code => registry.getMetadata(code)?.requiresUcp);
  let ucpResult = null;

  if (needsUcp) {
    if (!request.sector) {
      throw new Error('A sector is required for engines that rely on UCP calculations.');
    }
    const runUcp = createUcpRunner({
      requestId: request.requestId,
      userId: request.userId,
      projectId: request.projectId
    });
    const mergedValues = { ...(request.values || {}), ...(request.inputs || {}) };
    ucpResult = await runUcp({
      sector: request.sector,
      country: request.country,
      city: request.city,
      inputs: mergedValues,
      intent: request.intent
    });
  }

  const engineResults = {};
  const context = {
    ...request,
    registry,
    fabric,
    ucpResult,
    supabase: fabric?.supabase || request.supabase || null,
    engineResults
  };

  for (const code of mainEngines) {
    const result = await adapt(code, context);
    engineResults[code] = result;
  }

  // Post-processors see the full set of main-engine results.
  context.engineResults = engineResults;
  for (const code of postProcessors) {
    const result = await adapt(code, context);
    engineResults[code] = result;
  }

  const confidence = aggregateConfidence(engineResults, registry);
  const evidence = Object.entries(engineResults).flatMap(([code, result]) =>
    normalizeEvidence(code, result?.evidence)
  );

  const trace = {
    engines: engineCodes,
    mainEngines,
    postProcessors,
    needsUcp: !!ucpResult,
    timestamp: new Date().toISOString()
  };

  const runRecord = {
    engines: Object.fromEntries(
      Object.entries(engineResults).map(([code, r]) => [code, { confidence: r.confidence, status: r.status, output: r.output }])
    ),
    confidence,
    evidence,
    trace
  };

  if (fabric?.supabase && request.persist !== false) {
    try {
      await persistRun(fabric.supabase, {
        requestId: request.requestId,
        userId: request.userId,
        projectId: request.projectId,
        intent: request.intent,
        sector: request.sector,
        country: request.country,
        city: request.city,
        inputs: request.values || request.inputs || {},
        result: runRecord
      });
    } catch (err) {
      // Persistence is best-effort; do not fail the request.
      runRecord.persistenceError = err.message;
    }
  }

  return {
    engines: runRecord.engines,
    confidence,
    evidence,
    trace,
    recommendation: engineResults.recommendation_synthesizer?.output || null,
    blindSpots: engineResults.blind_spot?.output || null,
    decisionGraph: engineResults.decision_graph?.output || null
  };
}

async function persistRun(supabase, { requestId, userId, projectId, intent, sector, country, city, inputs, result }) {
  const { error } = await supabase.from('enterprise_intelligence_runs').insert({
    request_id: requestId || null,
    user_id: userId || null,
    project_id: projectId || null,
    intent: intent || null,
    sector: sector || null,
    country: country || null,
    city: city || null,
    inputs,
    result
  });
  if (error) throw error;
}

module.exports = {
  run,
  createDefaultRegistry,
  createFabric,
  normalizeEvidence,
  aggregateConfidence
};
