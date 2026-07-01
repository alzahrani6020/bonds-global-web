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
const { explain } = require('../explainability/explainability-engine');
const { trace } = require('../observability/observability');
const { createUcpRunner } = require('./ucp-bridge');
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
const ENGINE_RUNNERS = {
  valuation: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.valuation;
    return { value: ctx.market_value || 0, confidence: 50 };
  },
  financing: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.financing;
    return { dscr: ctx.dscr || 1.2, ltv: ctx.ltv || 0.7, confidence: 50 };
  },
  feasibility: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.feasibility;
    return { npv: 0, irr: 0, confidence: 50 };
  },
  risk: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.risk;
    return { risk_grade: 'C', confidence: 50 };
  },
  market: async (ctx) => {
    if (ctx.ucpResult) return ctx.ucpResult.engineResults.market;
    return { demand_index: 50, confidence: 50 };
  },
  knowledge: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) : 70 }),
  live_data: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) - 10 : 50 }),
  simulation: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) - 5 : 60 }),
  recommendation: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) - 5 : 65 }),
  decision_graph: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) : 70 }),
  evidence: async (ctx) => (ctx.ucpResult ? ctx.ucpResult.engineResults.evidence : { confidence: 80 }),
  certificate: async (ctx) => (ctx.ucpResult ? ctx.ucpResult.engineResults.certificate : { confidence: 80 }),
  report: async (ctx) => (ctx.ucpResult ? ctx.ucpResult.engineResults.report : { confidence: 80 }),
  ai: async (ctx) => ({ confidence: ctx.ucpResult ? Math.round(ctx.ucpResult.confidence * 100) - 10 : 60 })
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
      const runner = ENGINE_RUNNERS[engineName] || ENGINE_RUNNERS.ai;
      const ctx = {
        sector: form.sector,
        activity,
        country,
        city,
        userTier,
        ucpResult,
        ...request.values
      };
      const engineResult = await runner(ctx);
      engineResults[engineName] = engineResult;
      engineConfidences.push({ name: engineName, score: engineResult.confidence || 50, weight: 1 });
    }

    // 9. Confidence propagation
    operation.step('compute_confidence');
    const ucpConfidence = Math.round((ucpResult.confidence || 0) * 100);
    const finalConfidence = combineConfidence(
      [autoPopulate.overallConfidence, ucpConfidence],
      [1, 2]
    );
    const confidenceGrade = gradeConfidence(finalConfidence);
    const confidenceExplanation = explainConfidence(finalConfidence, [
      { name: 'auto_population', score: autoPopulate.overallConfidence, weight: 1 },
      { name: 'ucp_calculation', score: ucpConfidence, weight: 2 }
    ]);

    // 10. Build result
    const baseScenario = ucpResult.scenarios && ucpResult.scenarios.find(s => s.scenarioType === 'expected')
      ? ucpResult.scenarios.find(s => s.scenarioType === 'expected')
      : (ucpResult.scenarios && ucpResult.scenarios[0]);
    const ucpEvidence = baseScenario && baseScenario.evidence ? baseScenario.evidence : [];

    const result = {
      value: ucpResult.resultValue,
      confidence: finalConfidence,
      grade: confidenceGrade,
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
        }))
      ],
      ucp: ucpResult,
      risks: ruleResult.failures.map(f => f.message),
      recommendation: confidenceGrade === 'A' || confidenceGrade === 'B'
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
      ruleResult,
      engineResults,
      ucp: ucpResult,
      confidence: confidenceExplanation,
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
