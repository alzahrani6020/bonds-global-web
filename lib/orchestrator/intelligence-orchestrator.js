/**
 * BONDS Intelligence Orchestrator
 *
 * Coordinates all BONDS engines to turn a user request into an explained,
 * confidence-scored result ready for reports and certificates.
 */

const semantic = require('../semantic');
const { detectIntent } = require('../intent/intent-engine');
const { detectContext } = require('../context/decision-context-engine');
const { buildForm } = require('../forms/dynamic-form-engine');
const { populate, setFabric } = require('../auto-populate/auto-populate-engine');
const rulesEngine = require('../rules/business-rules-engine');
const { gradeConfidence, combineConfidence, explainConfidence } = require('../confidence/confidence-engine');
const { assessAutoPopulation } = require('../confidence/data-reliability-engine');
const { explain } = require('../explainability/explainability-engine');
const { trace } = require('../observability/observability');
const { createUcpRunner } = require('./ucp-bridge');
const { runResearchWorkflow } = require('../intelligence/research-workflow');
const {
  LiveMarketIntelligenceEngine,
  SimulationEngine,
  SectorDigitalTwinRegistry,
  DecisionRecommendationEngine,
  EvidenceGraphEngine,
  DecisionMemoryEngine
} = require('../decision-os');
const { DecisionGraphEngine } = require('../enterprise-intelligence/decision-graph-engine');
const { adapt: adaptEnterpriseEngine } = require('../enterprise-intelligence/engine-adapter');
const {
  TrustedDataFabric,
  ConnectorRegistry,
  SourceRegistry,
  DatabaseConnector,
  ManualConnector
} = require('../fabric');

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
      // Supabase not available in this environment; fabric will work with provided records only.
    }
  }

  registry.register(new DatabaseConnector({ supabase, sourceCode: 'database_metrics', sourceName: 'Normalized Metrics DB' }));
  registry.register(new ManualConnector({ supabase, sourceCode: 'manual', sourceName: 'Manual Override' }));

  return new TrustedDataFabric({ supabase, connectorRegistry: registry, sourceRegistry });
}

// Engine runners now delegate to the UCP Bridge when a calculation context is provided.
// If no UCP result is present, they fall back to conservative defaults.
function unavailableEngine(capability, details = {}) {
  return {
    status: 'insufficient_inputs',
    capability,
    available: true,
    executed: false,
    confidence: null,
    fallbackAvailable: true,
    ...details
  };
}

const ENGINE_RUNNERS = {
  valuation: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.valuation;
    if (Number.isFinite(Number(ctx.market_value))) {
      return { value: Number(ctx.market_value), confidence: 60, status: 'user_supplied', executed: true };
    }
    return unavailableEngine('valuation');
  },
  financing: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.financing;
    if (Number.isFinite(Number(ctx.dscr)) || Number.isFinite(Number(ctx.ltv))) {
      return { dscr: Number(ctx.dscr) || null, ltv: Number(ctx.ltv) || null, confidence: 60, status: 'user_supplied', executed: true };
    }
    return unavailableEngine('financing');
  },
  feasibility: async (ctx) => ctx.ucpResult
    ? ctx.ucpResult.engineResults.feasibility
    : unavailableEngine('feasibility', { requiredInputs: ['cash_flow', 'discount_rate'] }),
  risk: async (ctx) => ctx.ucpResult
    ? ctx.ucpResult.engineResults.risk
    : unavailableEngine('risk'),
  market: async (ctx) => {
    const live = new LiveMarketIntelligenceEngine().analyze(ctx);
    return live.executed ? live : (ctx.ucpResult?.engineResults?.market || unavailableEngine('market'));
  },
  knowledge: async (ctx) => {
    const result = ctx.ucpResult?.engineResults?.knowledge;
    return result?.executed === true ? result : unavailableEngine('knowledge', { reason: 'knowledge_engine_not_executed' });
  },
  live_data: async (ctx) => {
    const live = new LiveMarketIntelligenceEngine().analyze(ctx);
    return live.executed ? live : unavailableEngine('live_data', { reason: 'no_live_market_evidence' });
  },
  simulation: async (ctx) => {
    const simulation = new SimulationEngine().run(ctx);
    return simulation.executed ? simulation : unavailableEngine('simulation', {
      reason: 'simulation_inputs_not_available',
      requiredInputs: simulation.requiredInputs || []
    });
  },
  recommendation: async (ctx) => {
    try {
      return await adaptEnterpriseEngine('recommendation', ctx);
    } catch (err) {
      return unavailableEngine('recommendation', { reason: err.message });
    }
  },
  decision_graph: async (ctx) => {
    const graph = new DecisionGraphEngine(ctx).build();
    return {
      ...graph,
      executed: true,
      decisionEligible: true
    };
  },
  evidence: async (ctx) => ctx.ucpResult
    ? ctx.ucpResult.engineResults.evidence
    : unavailableEngine('evidence'),
  certificate: async (ctx) => ctx.ucpResult
    ? ctx.ucpResult.engineResults.certificate
    : unavailableEngine('certificate'),
  report: async (ctx) => ctx.ucpResult
    ? ctx.ucpResult.engineResults.report
    : unavailableEngine('report'),
  ai: async () => unavailableEngine('ai', { reason: 'ai_engine_not_executed' })
};

async function run(request) {
  return trace('intelligence-orchestrator', async (operation) => {
    const { input, sector, activity, context, userTier = 'free', language = 'ar', userId, country, city, currency = 'SAR' } = request;

    // 1. Intent detection
    operation.step('detect_intent', { input });
    const intentResult = detectIntent(input, { intent: request.intent, sector, action: request.action });
    if (!intentResult) {
      throw new Error('Could not detect user intent');
    }

    // 2. Semantic resolution
    operation.step('resolve_sector', { sector, activity });
    const sectorResult = semantic.resolveSector(sector);
    if (!sectorResult) {
      throw new Error(`Unknown sector: ${sector}`);
    }

    // 3. Decision context
    operation.step('detect_context', { context });
    const contextResult = detectContext(context, { intent: intentResult.intent });

    // 4. Dynamic form
    operation.step('build_form');
    const form = buildForm({
      sector,
      activity,
      intent: intentResult.intent,
      context,
      userTier,
      language
    });

    // 5. Auto population
    operation.step('auto_populate');
    const fabric = createFabric();
    setFabric(fabric);
    const autoPopulate = await populate(form, { sector, activity, country, city, userId });

    // 5a. Automatic research fallback for weak/missing evidence.
    // Research is additive and fail-closed: only structured, independently-supported
    // claims become evidence. It never overwrites deterministic financial inputs.
    operation.step('run_automatic_research');
    const researchWorkflow = await runResearchWorkflow(request, autoPopulate, {
      userId: request.userId,
      requestId: request.requestId || null
    });

    // 6. Business rules validation
    operation.step('evaluate_rules');
    const ruleResult = rulesEngine.evaluateAllRules({
      sector: form.sector,
      activity: activity || '',
      asset_class: activity || '',
      tier: userTier,
      language,
      data_quality_score: autoPopulate.overallConfidence,
      confidence_score: autoPopulate.overallConfidence
    });

    // 7. Run UCP-backed calculation
    operation.step('run_ucp');
    const mergedValues = {};
    for (const p of autoPopulate.populated) mergedValues[p.field] = p.value;
    Object.assign(mergedValues, request.values || {});

    const runUcp = createUcpRunner({
      requestId: request.requestId,
      userId: request.userId,
      projectId: request.projectId
    });
    const ucpResult = await runUcp({
      sector: form.sector,
      country,
      city,
      inputs: mergedValues,
      intent: intentResult.intent
    });

    // 8. Run required engine facades using UCP results
    operation.step('run_engines', { engines: form.requiredEngines });
    const engineResults = {};
    const engineConfidences = [];
    for (const engineName of form.requiredEngines) {
      const runner = ENGINE_RUNNERS[engineName] || (async () => unavailableEngine(engineName, { reason: 'unknown_engine_facade' }));
      const ctx = {
        sector: form.sector,
        activity,
        country,
        city,
        userTier,
        ucpResult,
        values: mergedValues,
        inputs: mergedValues,
        autoPopulate,
        liveData: request.liveData,
        liveDataRecords: request.liveDataRecords,
        requiredMarketMetrics: request.requiredMarketMetrics,
        simulationConfig: request.simulationConfig,
        engineResults,
        supabase: fabric?.supabase || null,
        ...request.values
      };
      const engineResult = await runner(ctx);
      engineResults[engineName] = engineResult;
      if (Number.isFinite(Number(engineResult.confidence))) {
        engineConfidences.push({ name: engineName, score: Number(engineResult.confidence), weight: 1 });
      }
    }

    // 9. Confidence propagation
    operation.step('compute_confidence');
    const ucpConfidence = Math.round((ucpResult.confidence || 0) * 100);
    const dataReliability = assessAutoPopulation(autoPopulate, form.fields || []);
    const finalConfidence = combineConfidence(
      [autoPopulate.overallConfidence, ucpConfidence, dataReliability.score],
      [1, 2, 2]
    );
    const confidenceGrade = gradeConfidence(finalConfidence);
    const confidenceExplanation = {
      ...explainConfidence(finalConfidence, [
        { name: 'auto_population', score: autoPopulate.overallConfidence, weight: 1 },
        { name: 'ucp_calculation', score: ucpConfidence, weight: 2 },
        { name: 'data_reliability', score: dataReliability.score, weight: 2 }
      ]),
      dimensions: dataReliability
    };

    // 10. Build result
    const baseScenario = ucpResult.scenarios && ucpResult.scenarios.find(s => s.scenarioType === 'expected')
      ? ucpResult.scenarios.find(s => s.scenarioType === 'expected')
      : (ucpResult.scenarios && ucpResult.scenarios[0]);
    const ucpEvidence = baseScenario && baseScenario.evidence ? baseScenario.evidence : [];

    const decisionCriticalEngines = new Set(['valuation', 'financing', 'feasibility', 'risk', 'market']);
    const requiredDecisionEngines = (form.requiredEngines || []).filter(name => decisionCriticalEngines.has(name));
    const blockedDecisionEngines = requiredDecisionEngines.filter(name => {
      const engine = engineResults[name];
      return !engine || engine.executed !== true || engine.decisionEligible === false;
    });
    const ucpGroundedCoverage = Math.round((ucpResult.groundedCoverage || 0) * 100);
    const researchHasConflict = (researchWorkflow.contradictions || []).length > 0;
    const researchNeedsReview = researchWorkflow.needed === true && researchWorkflow.decisionEligible !== true;
    const decisionIntegrity = {
      status: blockedDecisionEngines.length || ucpResult.validation?.valid === false || researchHasConflict
        ? 'blocked'
        : ((ucpGroundedCoverage < 70 || researchNeedsReview) ? 'review_required' : 'decision_ready'),
      groundedCoverage: ucpGroundedCoverage,
      researchStatus: researchWorkflow.status,
      researchNeeded: researchWorkflow.needed === true,
      researchDecisionEligible: researchWorkflow.decisionEligible === true,
      rawUcpConfidence: Math.round((ucpResult.rawConfidence || 0) * 100),
      effectiveUcpConfidence: ucpConfidence,
      requiredDecisionEngines,
      blockedDecisionEngines,
      validationValid: ucpResult.validation?.valid !== false,
      assumptionsUsed: ucpResult.bridge?.assumptionsUsed || [],
      syntheticInputs: ucpResult.bridge?.syntheticInputs || []
    };

    const canRecommendProceed =
      decisionIntegrity.status === 'decision_ready' &&
      (confidenceGrade === 'A' || confidenceGrade === 'B');

    // 10a. Additive Decision Operating System.
    // Existing engines stay intact; these layers consume their outputs and never
    // convert missing/not-executed capabilities into successful execution.
    operation.step('run_decision_os');

    const liveMarket = engineResults.live_data?.executed
      ? engineResults.live_data
      : (engineResults.market?.engine === 'live_market' || engineResults.market?.output?.metrics
        ? engineResults.market
        : new LiveMarketIntelligenceEngine().analyze({
            sector: form.sector,
            activity,
            country,
            city,
            autoPopulate,
            liveData: request.liveData,
            liveDataRecords: request.liveDataRecords,
            requiredMarketMetrics: request.requiredMarketMetrics
          }));

    const digitalTwin = new SectorDigitalTwinRegistry(request.sectorDigitalTwins || {})
      .evaluate(form.sector, mergedValues);

    const probabilitySimulation = engineResults.simulation?.engine === 'simulation'
      ? engineResults.simulation
      : new SimulationEngine().run({
          sector: form.sector,
          country,
          city,
          values: mergedValues,
          inputs: mergedValues,
          ucpResult,
          simulationConfig: request.simulationConfig
        });

    const decisionEngineResults = {
      ...engineResults,
      live_market: liveMarket,
      sector_digital_twin: digitalTwin,
      probability_simulation: probabilitySimulation,
      research_intelligence: {
        engine: 'research_intelligence',
        status: researchWorkflow.status,
        executed: researchWorkflow.executed === true,
        decisionEligible: researchWorkflow.decisionEligible !== false,
        confidence: researchWorkflow.verification?.result?.coverage != null
          ? Math.round(researchWorkflow.verification.result.coverage * 100)
          : null,
        evidence: researchWorkflow.evidence || [],
        output: researchWorkflow.synthesis?.result || null
      }
    };

    const decisionRecommendation = new DecisionRecommendationEngine().decide({
      engineResults: {
        ...decisionEngineResults,
        simulation: probabilitySimulation
      },
      simulation: probabilitySimulation,
      decisionIntegrity,
      confidence: finalConfidence
    });

    decisionEngineResults.decision_recommendation = decisionRecommendation;

    const evidenceGraph = new EvidenceGraphEngine().build({
      requestId: request.requestId || null,
      workflowId: request.workflowId || request.requestId || null,
      engineResults: decisionEngineResults,
      decision: decisionRecommendation.output,
      inputEvidence: [
        ...autoPopulate.populated.map(p => ({
          source: p.source,
          evidence_code: p.field,
          value: p.value,
          confidence: p.confidence,
          timestamp: p.timestamp,
          metadata: p.evidence || p.verification || null
        })),
        ...ucpEvidence,
        ...(researchWorkflow.evidence || [])
      ]
    });

    let decisionMemory = {
      output: { status: 'not_persisted', reason: 'persistence_not_requested' },
      confidence: finalConfidence,
      evidence: [],
      engine: 'decision_memory',
      status: 'not_persisted',
      executed: false,
      decisionEligible: true
    };

    if (request.persistDecision === true && request.projectId && request.userId) {
      const memoryEngine = new DecisionMemoryEngine({ supabase: fabric?.supabase || null });
      const memoryResult = await memoryEngine.recordDecision({
        projectId: request.projectId,
        entityId: request.projectId,
        requestId: request.requestId || null,
        workflowId: request.workflowId || request.requestId || null,
        decision: decisionRecommendation.output.primary,
        inputs: mergedValues,
        evidenceGraph: evidenceGraph.output,
        policyEvaluations: ruleResult,
        calculationVersion: ucpResult.version || ucpResult.schemaVersion || null,
        model: request.inferenceMetadata || null,
        expectedOutcome: {
          expected_npv: probabilitySimulation.output?.expectedNpv ?? engineResults.feasibility?.npv ?? null,
          probability_positive_npv: probabilitySimulation.output?.probabilityPositiveNpv ?? null,
          expected_dscr: engineResults.financing?.dscr ?? null
        },
        confidence: finalConfidence,
        userId: request.userId
      });
      decisionMemory = {
        output: memoryResult,
        confidence: finalConfidence,
        evidence: memoryResult.status === 'persisted' ? [{
          source: 'decision_memory',
          evidence_type: 'decision_record',
          evidence_code: 'decision_memory_record',
          value: memoryResult.record?.id || null,
          confidence: finalConfidence,
          timestamp: new Date().toISOString()
        }] : [],
        engine: 'decision_memory',
        status: memoryResult.status,
        executed: memoryResult.executed,
        decisionEligible: true
      };
    }

    const decisionOS = {
      liveMarket,
      digitalTwin,
      simulation: probabilitySimulation,
      decision: decisionRecommendation,
      evidenceGraph,
      memory: decisionMemory,
      research: researchWorkflow
    };

    const result = {
      value: ucpResult.resultValue,
      confidence: finalConfidence,
      grade: confidenceGrade,
      decisionIntegrity,
      inputs: [
        { name: 'sector', value: form.sector, source: 'semantic_layer' },
        { name: 'intent', value: intentResult.intent, source: 'intent_engine' },
        { name: 'context', value: contextResult ? contextResult.context : null, source: 'context_engine' }
      ],
      evidence: [
        ...autoPopulate.populated.map(p => ({
          source: p.source,
          evidence_type: 'input',
          evidence_code: p.field,
          value: p.value,
          confidence: p.confidence,
          timestamp: p.timestamp,
          metadata: p.evidence || p.verification || null
        })),
        ...ucpEvidence.map(e => ({
          source: e.source || 'ucp',
          evidence_type: e.evidence_type,
          evidence_code: e.evidence_code,
          value: e.value,
          confidence: e.confidence,
          timestamp: e.created_at
        })),
        ...(researchWorkflow.evidence || [])
      ],
      ucp: ucpResult,
      decisionOS,
      risks: ruleResult.failures.map(f => f.message),
      recommendation: canRecommendProceed
        ? (language === 'ar' ? 'موافق على المتابعة' : 'Proceed')
        : (language === 'ar' ? 'يحتاج مراجعة يدوية' : 'Needs manual review')
    };

    // 11. Explainability
    operation.step('generate_explanation');
    const explanation = explain(result, { language, currency });

    return {
      intent: intentResult,
      sector: sectorResult,
      context: contextResult,
      form,
      autoPopulate,
      research: researchWorkflow,
      ruleResult,
      engineResults,
      decisionOS,
      ucp: ucpResult,
      confidence: {
        ...confidenceExplanation,
        decisionIntegrity
      },
      explanation,
      reportType: form.reportTemplate,
      requiredTier: intentResult.requiredTier
    };
  });
}

/**
 * Build the intent/sector/context/form/auto-populate part without running UCP.
 * Useful for the Wave 4 intent-first entry page.
 */
async function buildIntentForm(request) {
  return trace('build-intent-form', async (operation) => {
    const { input, sector, activity, context, userTier = 'free', language = 'ar', userId, country, city } = request;

    operation.step('detect_intent', { input });
    const intentResult = detectIntent(input, { intent: request.intent, sector, action: request.action });
    if (!intentResult) {
      throw new Error('Could not detect user intent');
    }

    operation.step('resolve_sector', { sector, activity });
    const sectorResult = semantic.resolveSector(sector);
    if (!sectorResult) {
      throw new Error(`Unknown sector: ${sector}`);
    }

    operation.step('detect_context', { context });
    const contextResult = detectContext(context, { intent: intentResult.intent });

    operation.step('build_form');
    const form = buildForm({
      sector,
      activity,
      intent: intentResult.intent,
      context,
      userTier,
      language
    });

    operation.step('auto_populate');
    const fabric = createFabric();
    setFabric(fabric);
    const autoPopulate = await populate(form, { sector, activity, country, city, userId });

    return {
      intent: intentResult,
      sector: sectorResult,
      context: contextResult,
      form,
      autoPopulate,
      reportType: form.reportTemplate,
      requiredTier: intentResult.requiredTier
    };
  });
}

module.exports = {
  run,
  buildIntentForm,
  ENGINE_RUNNERS
};
