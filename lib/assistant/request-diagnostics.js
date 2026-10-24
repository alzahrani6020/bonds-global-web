'use strict';

const STATUS = Object.freeze({
  PASS:'PASS',
  DEGRADED:'DEGRADED',
  FAIL:'FAIL',
  SKIPPED:'SKIPPED',
  NOT_REQUIRED:'NOT_REQUIRED',
  NOT_AVAILABLE:'NOT_AVAILABLE'
});

function safeText(value, max = 160) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/[\r\n\t]+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function duration(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function traceEntries(trace, action) {
  return (Array.isArray(trace) ? trace : []).filter(item => item?.action === action);
}

function traceStatus(trace, action, { missing = STATUS.NOT_AVAILABLE } = {}) {
  const rows = traceEntries(trace, action);
  if (!rows.length) return missing;
  if (rows.some(row => row?.execution?.ok === true)) {
    return rows.some(row => row?.execution?.ok !== true) ? STATUS.DEGRADED : STATUS.PASS;
  }
  return STATUS.FAIL;
}

function firstTraceError(trace, action) {
  const row = traceEntries(trace, action).find(item => item?.execution?.ok !== true);
  return safeText(row?.execution?.error?.code || row?.execution?.error?.message || null);
}

function pushStage(stages, stage, status, durationMs = null, extra = {}) {
  stages.push({
    stage,
    status,
    duration_ms:duration(durationMs),
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined))
  });
}

function researchRootCauseStage(research = {}) {
  const status = String(research.status || '');
  if (status === 'search_failed') return 'search_transport';
  if (status === 'search_low_relevance') return 'search_relevance';
  if (status === 'acquisition_failed') return 'explore';
  if (['verification_failed', 'insufficient_evidence', 'blocked'].includes(status)) return 'evidence';
  if (status === 'AI_SYNTHESIS_FAILED') return 'ai_generate';
  if (status === 'ANSWER_QUALITY_FAILED') {
    return research.repair_attempted === true ? 'repair_quality_gate' : 'initial_quality_gate';
  }
  if (research.decision_eligible === false) return 'evidence';
  return null;
}

function researchPipelineStage(research = {}) {
  const rootCause = researchRootCauseStage(research);
  if (['search_transport', 'search_relevance', 'explore', 'evidence'].includes(rootCause)) {
    return 'research_acquisition';
  }
  if (rootCause === 'ai_generate') return 'ai_generation';
  if (['initial_quality_gate', 'repair_quality_gate'].includes(rootCause)) return 'answer_quality';
  return null;
}

function researchErrorCode(research = {}, trace = []) {
  if (research.quality_code) return safeText(research.quality_code);
  const status = safeText(research.status);
  if (status && status !== 'completed') return status;
  for (const action of ['web_search','web_explore','evidence_verify','research_synthesize']) {
    const code = firstTraceError(trace, action);
    if (code) return code;
  }
  return null;
}

function buildResearchStages(loopResult, stages) {
  const research = loopResult?.research || null;
  const trace = Array.isArray(loopResult?.trace) ? loopResult.trace : [];

  if (!research) {
    pushStage(stages, 'research_acquisition', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search_transport', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search_relevance', STATUS.NOT_REQUIRED);
    pushStage(stages, 'explore', STATUS.NOT_REQUIRED);
    pushStage(stages, 'evidence', STATUS.NOT_REQUIRED);
    pushStage(stages, 'ai_generate', STATUS.NOT_AVAILABLE);
    pushStage(stages, 'initial_quality_gate', STATUS.NOT_REQUIRED);
    pushStage(stages, 'repair_attempt', STATUS.NOT_REQUIRED);
    pushStage(stages, 'repair_quality_gate', STATUS.NOT_REQUIRED);
    return;
  }

  const timings = research.timings || loopResult?.research_timings || {};
  const rootCauseStage = researchRootCauseStage(research);
  const status = String(research.status || '');
  const acquisitionFailed = ['search_transport', 'search_relevance', 'explore', 'evidence'].includes(rootCauseStage);
  const researchAcquisitionPassed = research.decision_eligible === true ||
    ['completed', 'AI_SYNTHESIS_FAILED', 'ANSWER_QUALITY_FAILED'].includes(status);

  pushStage(
    stages,
    'research_acquisition',
    researchAcquisitionPassed ? STATUS.PASS : (acquisitionFailed ? STATUS.FAIL : STATUS.NOT_AVAILABLE),
    research.research_acquisition_ms
  );

  const searchTransportStatus = rootCauseStage === 'search_transport'
    ? STATUS.FAIL
    : traceStatus(trace, 'web_search', { missing:STATUS.NOT_AVAILABLE });
  pushStage(stages, 'search_transport', searchTransportStatus, timings.search_ms);

  let searchRelevanceStatus = STATUS.NOT_AVAILABLE;
  if (rootCauseStage === 'search_transport') {
    searchRelevanceStatus = STATUS.SKIPPED;
  } else if (rootCauseStage === 'search_relevance') {
    searchRelevanceStatus = STATUS.FAIL;
  } else if (
    researchAcquisitionPassed ||
    ['explore', 'evidence', 'ai_generate', 'initial_quality_gate', 'repair_quality_gate'].includes(rootCauseStage)
  ) {
    searchRelevanceStatus = STATUS.PASS;
  }
  pushStage(stages, 'search_relevance', searchRelevanceStatus);

  const stoppedAtSearch = ['search_transport', 'search_relevance'].includes(rootCauseStage);
  const exploreStatus = stoppedAtSearch
    ? STATUS.SKIPPED
    : (rootCauseStage === 'explore'
        ? STATUS.FAIL
        : traceStatus(trace, 'web_explore', {
            missing: researchAcquisitionPassed || ['evidence','ai_generate','initial_quality_gate','repair_quality_gate'].includes(rootCauseStage)
              ? STATUS.NOT_AVAILABLE
              : STATUS.SKIPPED
          }));
  pushStage(stages, 'explore', exploreStatus, timings.explore_ms);

  const stoppedBeforeEvidence = stoppedAtSearch || rootCauseStage === 'explore';
  const evidenceStatus = stoppedBeforeEvidence
    ? STATUS.SKIPPED
    : (rootCauseStage === 'evidence'
        ? STATUS.FAIL
        : traceStatus(trace, 'evidence_verify', {
            missing: researchAcquisitionPassed || ['ai_generate','initial_quality_gate','repair_quality_gate'].includes(rootCauseStage)
              ? STATUS.NOT_AVAILABLE
              : STATUS.SKIPPED
          }));
  pushStage(
    stages,
    'evidence',
    evidenceStatus,
    timings.verify_ms,
    {
      decision_eligible:typeof research.decision_eligible === 'boolean' ? research.decision_eligible : undefined,
      verification_state:safeText(research.verification_state)
    }
  );

  const stoppedBeforeGeneration = acquisitionFailed;
  let aiGenerateStatus;
  if (stoppedBeforeGeneration) {
    aiGenerateStatus = STATUS.SKIPPED;
  } else if (rootCauseStage === 'ai_generate') {
    aiGenerateStatus = STATUS.FAIL;
  } else if (
    research.answer_synthesis_ms != null ||
    traceEntries(trace, 'research_synthesize').length ||
    ['completed', 'ANSWER_QUALITY_FAILED'].includes(status)
  ) {
    aiGenerateStatus = traceStatus(trace, 'research_synthesize', { missing:STATUS.PASS });
  } else {
    aiGenerateStatus = STATUS.NOT_AVAILABLE;
  }
  pushStage(
    stages,
    'ai_generate',
    aiGenerateStatus,
    research.answer_synthesis_ms ?? timings.synthesize_ms
  );

  const initialQualityCode = safeText(research.initial_quality_code || research.quality_code);
  const initialQualityFailed = initialQualityCode && initialQualityCode !== 'PASS';
  const repairAttempted = research.repair_attempted === true;
  const repairSucceeded = research.repair_succeeded === true;

  let initialQualityStatus;
  if (stoppedBeforeGeneration || rootCauseStage === 'ai_generate') {
    initialQualityStatus = STATUS.SKIPPED;
  } else if (initialQualityFailed) {
    initialQualityStatus = repairSucceeded ? STATUS.DEGRADED : STATUS.FAIL;
  } else if (status === 'completed') {
    initialQualityStatus = STATUS.PASS;
  } else {
    initialQualityStatus = STATUS.NOT_AVAILABLE;
  }
  pushStage(
    stages,
    'initial_quality_gate',
    initialQualityStatus,
    research.initial_quality_ms,
    { quality_code:initialQualityCode }
  );

  pushStage(
    stages,
    'repair_attempt',
    repairAttempted ? STATUS.PASS : STATUS.NOT_REQUIRED,
    research.repair_ms,
    { quality_code:safeText(research.repair_quality_code) }
  );

  pushStage(
    stages,
    'repair_quality_gate',
    repairAttempted
      ? (repairSucceeded ? STATUS.PASS : STATUS.FAIL)
      : STATUS.NOT_REQUIRED,
    research.repair_quality_ms,
    { quality_code:safeText(research.repair_quality_code) }
  );
}

function buildRequestDiagnostics({
  requestId = null,
  path = 'UNKNOWN',
  loopResult = null,
  aiResult = null,
  nativeError = null,
  totalMs = null
} = {}) {
  const stages = [];
  pushStage(stages, 'intent', STATUS.PASS);
  pushStage(stages, 'planner', loopResult ? STATUS.PASS : STATUS.NOT_AVAILABLE);

  if (loopResult) {
    buildResearchStages(loopResult, stages);
  } else {
    pushStage(stages, 'research_acquisition', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search_transport', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search_relevance', STATUS.NOT_REQUIRED);
    pushStage(stages, 'explore', STATUS.NOT_REQUIRED);
    pushStage(stages, 'evidence', STATUS.NOT_REQUIRED);
    pushStage(
      stages,
      'ai_generate',
      nativeError
        ? (aiResult?.reply ? STATUS.DEGRADED : STATUS.FAIL)
        : (aiResult?.reply ? STATUS.PASS : STATUS.NOT_AVAILABLE),
      aiResult?.inference?.request_elapsed_ms ?? nativeError?.elapsedMs
    );
    pushStage(stages, 'initial_quality_gate', STATUS.NOT_REQUIRED);
    pushStage(stages, 'repair_attempt', STATUS.NOT_REQUIRED);
    pushStage(stages, 'repair_quality_gate', STATUS.NOT_REQUIRED);
  }

  const finalFailed = Boolean(loopResult?.failed) || Boolean(nativeError && !aiResult?.reply) || !((loopResult?.reply) || aiResult?.reply);
  pushStage(stages, 'final_answer', finalFailed ? STATUS.FAIL : STATUS.PASS);

  const failed = stages.find(stage => stage.status === STATUS.FAIL) || null;
  const degraded = stages.some(stage => stage.status === STATUS.DEGRADED) ||
    Boolean(nativeError && aiResult?.reply);
  const bottleneck = stages
    .filter(stage => Number.isFinite(stage.duration_ms))
    .sort((a, b) => b.duration_ms - a.duration_ms)[0] || null;

  const trace = Array.isArray(loopResult?.trace) ? loopResult.trace : [];
  const research = loopResult?.research || null;
  const errorCode = researchErrorCode(research || {}, trace) ||
    safeText(nativeError?.code || nativeError?.message || null);
  const rootCauseStage = research ? researchRootCauseStage(research) : (failed?.stage || null);
  const pipelineStage = research ? researchPipelineStage(research) : (failed ? 'runtime' : null);
  const serverProcessingMs = duration(totalMs);

  return {
    schema_version:2,
    request_id:safeText(requestId, 120),
    path:safeText(path, 80),
    status:failed ? STATUS.FAIL : (degraded ? STATUS.DEGRADED : STATUS.PASS),
    stages,
    pipeline_stage:pipelineStage,
    root_cause_stage:rootCauseStage,
    failure_stage:rootCauseStage,
    error_code:errorCode,
    timing:{
      server_processing_ms:serverProcessingMs,
      api_roundtrip_ms:null,
      client_parse_ms:null,
      ui_render_ms:null,
      end_to_end_ms:null
    },
    total_ms:serverProcessingMs,
    bottleneck:bottleneck ? { stage:bottleneck.stage, duration_ms:bottleneck.duration_ms } : null,
    provider:safeText(aiResult?.provider || 'BONDS', 80),
    fallback_used:Boolean(nativeError && aiResult?.reply),
    fallback_reason:safeText(nativeError?.code || nativeError?.message || null),
    tool_chain:trace.slice(0, 12).map(item => ({
      action:safeText(item?.action, 80),
      status:item?.execution?.ok === true ? STATUS.PASS : STATUS.FAIL,
      error_code:safeText(item?.execution?.error?.code || null)
    })),
    research_quality:research ? {
      initial_quality_code:safeText(research.initial_quality_code || research.quality_code),
      repair_attempted:research.repair_attempted === true,
      repair_ms:duration(research.repair_ms),
      repair_quality_code:safeText(research.repair_quality_code),
      repair_succeeded:research.repair_succeeded === true
    } : null,
    evidence:research ? {
      source_count:Number.isFinite(Number(research.source_count)) ? Number(research.source_count) : null,
      evidence_count:Number.isFinite(Number(research.evidence_count)) ? Number(research.evidence_count) : null,
      decision_eligible:typeof research.decision_eligible === 'boolean' ? research.decision_eligible : null,
      unknown_count:Array.isArray(research.unknowns) ? research.unknowns.length : 0,
      contradiction_count:Array.isArray(research.contradictions) ? research.contradictions.length : 0
    } : null
  };
}

module.exports = {
  STATUS,
  buildRequestDiagnostics,
  researchRootCauseStage,
  researchPipelineStage
};
