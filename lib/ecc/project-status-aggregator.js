/**
 * BONDS Executive Command Center — Project Status Aggregator
 *
 * Gathers all project intelligence from existing engines and tables into a
 * single, explainable, confidence-scored status object. No new calculations.
 */

const { resolveProjectContext, InvestmentReadinessEngine } = require('../investment-intelligence');
const { run: runEnterpriseIntelligence } = require('../enterprise-intelligence');
const { LifecycleEngine } = require('../enterprise-lifecycle');
const { DigitalTwin } = require('../digital-twin/digital-twin');
const ConfidenceEngine = require('../confidence/confidence-engine');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchLatestReadiness(supabase, projectId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('investment_readiness_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[ECC] readiness fetch failed:', error.message);
    return null;
  }
  return data && data[0] ? data[0] : null;
}

async function fetchLatestMemorandum(supabase, projectId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('investment_memoranda')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[ECC] memorandum fetch failed:', error.message);
    return null;
  }
  return data && data[0] ? data[0] : null;
}

async function fetchLatestAiReview(supabase, projectId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('ai_investment_reviews')
    .select('*')
    .eq('project_id', projectId)
    .order('reviewed_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[ECC] AI review fetch failed:', error.message);
    return null;
  }
  return data && data[0] ? data[0] : null;
}

async function findOrCreateLifecycleInstance(engine, projectId, userId) {
  try {
    const { data: existing } = await engine.store.supabase
      .from('enterprise_lifecycle_instances')
      .select('*')
      .eq('entity_id', projectId)
      .eq('entity_type', 'project')
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing[0]) {
      return existing[0];
    }

    if (!userId) return null;

    const { instance } = await engine.createInstance({
      entityType: 'project',
      entityId: projectId,
      userId
    });
    return instance;
  } catch (err) {
    console.warn('[ECC] lifecycle instance lookup failed:', err.message);
    return null;
  }
}

function computeFundingScore(financing, ucpResult) {
  const financingResult = ucpResult?.engineResults?.financing;
  if (financingResult?.dscr !== undefined) {
    const dscr = normalizeNumber(financingResult.dscr);
    if (dscr >= 1.5) return 90;
    if (dscr >= 1.25) return 75;
    if (dscr >= 1.0) return 60;
    return 40;
  }
  if (financing?.dscr) {
    const dscr = normalizeNumber(financing.dscr);
    if (dscr >= 1.5) return 90;
    if (dscr >= 1.25) return 75;
    if (dscr >= 1.0) return 60;
    return 40;
  }
  return financing ? 60 : 30;
}

function computeValuationStatus(valuation) {
  if (!valuation) return { status: 'missing', score: 0, label: 'غير متوفر' };
  const confidence = normalizeNumber(valuation.confidence_score);
  if (valuation.status === 'final' || valuation.status === 'approved') {
    return { status: 'complete', score: confidence, label: 'مكتمل' };
  }
  if (valuation.status === 'draft') {
    return { status: 'draft', score: confidence, label: 'مسودة' };
  }
  return { status: 'available', score: confidence, label: 'متاح' };
}

function normalizeReadiness(readiness) {
  if (!readiness) return { score: 0, missingItems: [] };
  const score = readiness.readinessScore !== undefined && readiness.readinessScore !== null
    ? normalizeNumber(readiness.readinessScore)
    : normalizeNumber(readiness.readiness_score);
  const missingItems = readiness.missing_items || readiness.missingItems || [];
  return { score, missingItems };
}

function deriveNextBestAction(lifecycleState, readiness, valuationStatus, memorandum, aiReview) {
  const stage = lifecycleState?.currentStage || 'idea';
  const { score: readinessScore, missingItems } = normalizeReadiness(readiness);

  if (stage === 'idea') {
    return {
      action: 'Run feasibility study via UCP',
      action_ar: 'تشغيل دراسة الجدوى عبر منصة الحساب الموحد',
      reason: 'Project is at idea stage; financial feasibility must be established first.',
      reason_ar: 'المشروع في مرحلة الفكرة؛ يجب إثبات الجدوى المالية أولاً.',
      priority: 'critical'
    };
  }

  if (stage === 'feasibility') {
    return {
      action: 'Complete valuation to move to funding stage',
      action_ar: 'إكمال التقييم للانتقال إلى مرحلة التمويل',
      reason: 'Valuation confidence is required by the funding gate.',
      reason_ar: 'ثقة التقييل مطلوبة لبوابة التمويل.',
      priority: 'high'
    };
  }

  if (stage === 'valuation' || stage === 'funding') {
    return {
      action: 'Review funding structure and DSCR',
      action_ar: 'مراجعة هيكل التمويل ونسبة تغطية خدمة الدين',
      reason: 'Funding structure completeness determines readiness for investment documentation.',
      reason_ar: 'اكتمال هيكل التمويل يحدد الجاهزية لتوثيق الاستثمار.',
      priority: 'high'
    };
  }

  if (stage === 'investment_readiness' && readinessScore < 70) {
    return {
      action: 'Address readiness gaps',
      action_ar: 'معالجة فجوات الجاهزية',
      reason: missingItems.length
        ? `Missing: ${missingItems.join(', ')}`
        : 'Readiness score is below the threshold to create an investment memorandum.',
      reason_ar: missingItems.length
        ? `ناقص: ${missingItems.join('، ')}`
        : 'درجة الجاهزية أقل من الحد الأدنى لإنشاء المذكرة الاستثمارية.',
      priority: readinessScore < 60 ? 'critical' : 'high'
    };
  }

  if (stage === 'investment_readiness' && (!memorandum || memorandum.status === 'draft')) {
    return {
      action: 'Generate investment memorandum',
      action_ar: 'إنشاء المذكرة الاستثمارية',
      reason: 'Project is ready; the memorandum is the required deliverable for investor matching.',
      reason_ar: 'المشروع جاهز؛ المذكرة الاستثمارية هي المخرجات المطلوبة لمطابقة المستثمر.',
      priority: 'high'
    };
  }

  if (stage === 'investment_memorandum' && (!aiReview || aiReview.verdict !== 'approved')) {
    return {
      action: 'Request AI review of the memorandum',
      action_ar: 'طلب مراجعة الذكاء الاصطناعي للمذكرة',
      reason: 'AI review must approve the memorandum before it can be shared with investors.',
      reason_ar: 'يجب أن توافق مراجعة AI على المذكرة قبل مشاركتها مع المستثمرين.',
      priority: 'high'
    };
  }

  if (stage === 'ai_review') {
    return {
      action: 'Approve memorandum and start investor matching',
      action_ar: 'اعتماد المذكرة وبدء مطابقة المستثمر',
      reason: 'Memorandum passed AI review; seek human approval to proceed.',
      reason_ar: 'المذكرة اجتازت مراجعة AI؛ يجب الحصول على الموافقة البشرية للمتابعة.',
      priority: 'medium'
    };
  }

  // Catch-all for low readiness regardless of stage
  if (readinessScore > 0 && readinessScore < 60) {
    return {
      action: 'Address readiness gaps',
      action_ar: 'معالجة فجوات الجاهزية',
      reason: missingItems.length
        ? `Missing: ${missingItems.join(', ')}`
        : 'Readiness score is below healthy threshold.',
      reason_ar: missingItems.length
        ? `ناقص: ${missingItems.join('، ')}`
        : 'درجة الجاهزية أقل من الحد الصحي.',
      priority: 'critical'
    };
  }

  const nextTransition = lifecycleState?.allowedTransitions?.find(t => !t.optional);
  if (nextTransition) {
    return {
      action: `Move to ${nextTransition.to}`,
      action_ar: `الانتقال إلى ${nextTransition.to}`,
      reason: 'Next lifecycle transition is available.',
      reason_ar: 'الانتقال التالي في دورة الحياة متاح.',
      priority: 'medium'
    };
  }

  return {
    action: 'Monitor project performance',
    action_ar: 'مراقبة أداء المشروع',
    reason: 'No immediate action required.',
    reason_ar: 'لا يوجد إجراء فوري مطلوب.',
    priority: 'low'
  };
}

function deriveCriticalAlerts(lifecycleState, readiness, valuationStatus, financing, intelligence) {
  const alerts = [];
  const readinessScore = readiness
    ? (readiness.readinessScore !== undefined && readiness.readinessScore !== null
        ? normalizeNumber(readiness.readinessScore)
        : normalizeNumber(readiness.readiness_score))
    : 0;

  if (lifecycleState?.blockedPaths?.length) {
    alerts.push({
      type: 'blocked',
      title: 'مسار مقفل',
      message: `لا يمكن الوصول إلى ${lifecycleState.blockedPaths.length} مرحلة/مراحل من المرحلة الحالية.`,
      priority: 'medium'
    });
  }

  if (readinessScore > 0 && readinessScore < 60) {
    alerts.push({
      type: 'readiness',
      title: 'جاهزية منخفضة',
      message: `درجة جاهزية الاستثمار ${readinessScore} وهي أقل من الحد الأدنى.`,
      priority: 'high'
    });
  }

  if (valuationStatus.status === 'missing') {
    alerts.push({
      type: 'valuation',
      title: 'لا يوجد تقييم',
      message: 'لم يتم إجراء تقييم رسمي للمشروع بعد.',
      priority: 'high'
    });
  }

  if (financing && normalizeNumber(financing.dscr) < 1.25) {
    alerts.push({
      type: 'financing',
      title: 'مخاطر تمويل',
      message: `نسبة تغطية خدمة الدين (DSCR) ${financing.dscr} أقل من 1.25.`,
      priority: 'critical'
    });
  }

  const blindSpots = intelligence?.blindSpots?.blind_spots || intelligence?.blindSpots || [];
  if (Array.isArray(blindSpots) && blindSpots.length) {
    blindSpots.slice(0, 3).forEach(spot => {
      alerts.push({
        type: 'blind_spot',
        title: spot.title || 'نقطة عمياء',
        message: spot.description || spot.message || 'بيانات ناقصة أو متناقضة.',
        priority: spot.severity === 'high' ? 'critical' : 'medium'
      });
    });
  }

  return alerts;
}

async function aggregateProjectStatus({ projectId, supabase, userId, options = {} }) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!projectId) throw new Error('projectId is required');

  // 1. Resolve canonical project context (project + asset + valuation + financing + city + UCP)
  const projectContext = await resolveProjectContext({ projectId, supabase });
  const { project, asset, valuation, financing, city, ucpResult } = projectContext;

  // 2. Investment readiness
  let readiness = null;
  try {
    const readinessEngine = new InvestmentReadinessEngine(projectContext);
    readiness = readinessEngine.evaluate();
  } catch (err) {
    console.warn('[ECC] readiness evaluation failed:', err.message);
    readiness = await fetchLatestReadiness(supabase, projectId);
  }
  if (!readiness) {
    readiness = await fetchLatestReadiness(supabase, projectId);
  }

  // 3. Latest memorandum and AI review
  const memorandum = await fetchLatestMemorandum(supabase, projectId);
  const aiReview = await fetchLatestAiReview(supabase, projectId);

  // 4. Lifecycle state
  let lifecycleState = null;
  let timeline = [];
  let tasks = [];
  let approvals = [];
  try {
    const lifecycleEngine = await new LifecycleEngine({ supabase }).initialize();
    const instance = await findOrCreateLifecycleInstance(lifecycleEngine, projectId, userId);
    if (instance) {
      lifecycleState = await lifecycleEngine.getState(instance.id);
      timeline = await lifecycleEngine.getTimeline(instance.id);
      tasks = await lifecycleEngine.getTasks(instance.id);
      approvals = await lifecycleEngine.store.listApprovals(instance.id);
    }
  } catch (err) {
    console.warn('[ECC] lifecycle fetch failed:', err.message);
  }

  // 5. Digital twin snapshot
  let digitalTwin = null;
  try {
    const twin = new DigitalTwin(supabase);
    digitalTwin = await twin.build(projectId);
  } catch (err) {
    console.warn('[ECC] digital twin build failed:', err.message);
  }

  // 6. Enterprise intelligence run
  let intelligence = null;
  try {
    const inputs = {};
    if (ucpResult?.outputs) {
      Object.assign(inputs, ucpResult.outputs);
    }
    intelligence = await runEnterpriseIntelligence({
      intent: 'investment',
      sector: project.sector,
      country: city?.country_code || 'SA',
      city: city?.code,
      values: inputs,
      projectId,
      userId,
      supabase,
      persist: false // avoid persisting ECC views as intelligence runs
    });
  } catch (err) {
    console.warn('[ECC] enterprise intelligence run failed:', err.message);
  }

  // 7. Aggregate confidence
  const confidenceInputs = [];
  if (readiness?.readinessScore !== undefined) {
    confidenceInputs.push({ name: 'readiness', score: readiness.readinessScore, weight: 0.25 });
  }
  if (valuation?.confidence_score !== undefined) {
    confidenceInputs.push({ name: 'valuation', score: normalizeNumber(valuation.confidence_score), weight: 0.2 });
  }
  if (ucpResult?.confidence !== undefined) {
    confidenceInputs.push({ name: 'ucp', score: normalizeNumber(ucpResult.confidence), weight: 0.25 });
  }
  if (lifecycleState && typeof lifecycleState.currentStage === 'string') {
    // Lifecycle completeness contributes a base confidence of 70 if active.
    confidenceInputs.push({ name: 'lifecycle', score: 70, weight: 0.1 });
  }
  if (intelligence?.confidence !== undefined) {
    confidenceInputs.push({ name: 'intelligence', score: normalizeNumber(intelligence.confidence), weight: 0.2 });
  }

  // Normalize readiness fields regardless of source (DB snake_case vs engine camelCase)
  const readinessScore = readiness
    ? (readiness.readinessScore !== undefined && readiness.readinessScore !== null
        ? normalizeNumber(readiness.readinessScore)
        : normalizeNumber(readiness.readiness_score))
    : 0;
  const readinessGrade = readiness?.grade || null;
  const readinessMissingItems = readiness?.missing_items || readiness?.missingItems || [];

  let aggregateConfidence = 50;
  if (confidenceInputs.length) {
    aggregateConfidence = ConfidenceEngine.combineConfidence(
      confidenceInputs.map(i => i.score),
      confidenceInputs.map(i => i.weight)
    );
  }

  // 8. Derived metrics
  const fundingScore = computeFundingScore(financing, ucpResult);
  const valuationStatus = computeValuationStatus(valuation);
  const completionPct = readinessScore;
  const riskLevel = readinessGrade
    ? { A: 'low', B: 'low', C: 'medium', D: 'high', E: 'critical' }[readinessGrade] || 'medium'
    : 'medium';

  const nextBestAction = deriveNextBestAction(lifecycleState, readiness, valuationStatus, memorandum, aiReview);
  const criticalAlerts = deriveCriticalAlerts(lifecycleState, readiness, valuationStatus, financing, intelligence);

  // 9. Unified status
  const status = {
    project: {
      id: project.id,
      name: project.name,
      number: project.project_number,
      sector: project.sector,
      sub_sector: project.sub_sector,
      activity: project.activity,
      city: city?.name || project.city,
      country: city?.country_code || project.country_code,
      currency: project.currency,
      language: project.language || 'ar'
    },
    health: {
      projectHealth: aggregateConfidence >= 80 ? 'healthy' : aggregateConfidence >= 60 ? 'attention' : 'at_risk',
      readinessScore,
      readinessGrade,
      confidence: aggregateConfidence,
      riskLevel,
      completionPercentage: completionPct,
      investmentScore: readiness?.readinessScore || 0,
      fundingScore,
      valuationStatus
    },
    lifecycle: lifecycleState
      ? { ...lifecycleState, instanceId: lifecycleState.instance?.id || lifecycleState.instance?.instance_id }
      : null,
    mission: {
      currentStage: lifecycleState?.currentStage || 'idea',
      nextBestAction,
      criticalAlerts,
      blockedPaths: lifecycleState?.blockedPaths || [],
      criticalPath: lifecycleState?.criticalPath || []
    },
    intelligence: intelligence
      ? {
          confidence: intelligence.confidence,
          recommendation: intelligence.recommendation,
          blindSpots: intelligence.blindSpots,
          decisionGraph: intelligence.decisionGraph,
          evidence: intelligence.evidence
        }
      : null,
    documents: {
      memorandum: memorandum
        ? { id: memorandum.id, status: memorandum.status, version: memorandum.version, confidence: memorandum.confidence_score }
        : null,
      aiReview: aiReview
        ? { id: aiReview.id, verdict: aiReview.verdict, confidence: aiReview.confidence_score }
        : null
    },
    financial: {
      capital: normalizeNumber(project.capital),
      revenue: normalizeNumber(project.revenue),
      annualProfit: normalizeNumber(project.annual_profit),
      assetValue: normalizeNumber(valuation?.value || asset?.market_value),
      financingAmount: normalizeNumber(financing?.amount),
      dscr: normalizeNumber(financing?.dscr),
      ucpOutputs: ucpResult?.outputs || null
    },
    digitalTwin: digitalTwin?.snapshot || null,
    timeline,
    tasks,
    approvals,
    meta: {
      generatedAt: new Date().toISOString(),
      enginesUsed: ['investment-intelligence', 'enterprise-intelligence', 'enterprise-lifecycle', 'digital-twin', 'confidence'],
      confidenceInputs
    }
  };

  return status;
}

module.exports = {
  aggregateProjectStatus,
  deriveNextBestAction,
  deriveCriticalAlerts,
  computeFundingScore,
  computeValuationStatus
};
