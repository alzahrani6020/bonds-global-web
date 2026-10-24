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

function traceStatus(trace, action, { required = false } = {}) {
  const rows = traceEntries(trace, action);
  if (!rows.length) return required ? STATUS.FAIL : STATUS.NOT_REQUIRED;
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

function researchFailureStage(research = {}) {
  const status = String(research.status || '');
  if (status === 'AI_SYNTHESIS_FAILED') return 'ai_generate';
  if (status === 'ANSWER_QUALITY_FAILED') return 'quality_gate';
  if (['search_failed', 'search_low_relevance'].includes(status)) return 'search';
  if (status === 'acquisition_failed') return 'explore';
  if (['verification_failed', 'insufficient_evidence', 'blocked'].includes(status)) return 'evidence';
  return research.decision_eligible === false ? 'evidence' : null;
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
    pushStage(stages, 'research', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search', STATUS.NOT_REQUIRED);
    pushStage(stages, 'explore', STATUS.NOT_REQUIRED);
    pushStage(stages, 'evidence', STATUS.NOT_REQUIRED);
    pushStage(stages, 'ai_generate', STATUS.PASS);
    pushStage(stages, 'quality_gate', STATUS.NOT_REQUIRED);
    return;
  }

  const timings = research.timings || loopResult?.research_timings || {};
  const failedStage = researchFailureStage(research);
  const researchAcquisitionPassed = research.decision_eligible === true ||
    ['completed', 'AI_SYNTHESIS_FAILED', 'ANSWER_QUALITY_FAILED'].includes(String(research.status || ''));
  pushStage(
    stages,
    'research',
    researchAcquisitionPassed ? STATUS.PASS : (loopResult?.failed ? STATUS.FAIL : STATUS.DEGRADED),
    research.elapsed_ms
  );

  pushStage(stages, 'search', traceStatus(trace, 'web_search', { required:true }), timings.search_ms);
  pushStage(stages, 'explore', traceStatus(trace, 'web_explore', { required:true }), timings.explore_ms);
  pushStage(
    stages,
    'evidence',
    failedStage === 'evidence' ? STATUS.FAIL : traceStatus(trace, 'evidence_verify', { required:true }),
    timings.verify_ms,
    {
      decision_eligible:typeof research.decision_eligible === 'boolean' ? research.decision_eligible : undefined,
      verification_state:safeText(research.verification_state)
    }
  );

  const synthFailed = failedStage === 'ai_generate';
  const qualityFailed = failedStage === 'quality_gate';
  pushStage(
    stages,
    'ai_generate',
    synthFailed ? STATUS.FAIL : (traceStatus(trace, 'research_synthesize') === STATUS.FAIL ? STATUS.FAIL : STATUS.PASS),
    research.answer_synthesis_ms ?? timings.synthesize_ms
  );
  pushStage(
    stages,
    'quality_gate',
    qualityFailed ? STATUS.FAIL : (research.status === 'completed' ? STATUS.PASS : STATUS.SKIPPED),
    research.quality_ms,
    { quality_code:safeText(research.quality_code) }
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
    pushStage(stages, 'research', STATUS.NOT_REQUIRED);
    pushStage(stages, 'search', STATUS.NOT_REQUIRED);
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
    pushStage(stages, 'quality_gate', STATUS.NOT_REQUIRED);
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

  return {
    schema_version:1,
    request_id:safeText(requestId, 120),
    path:safeText(path, 80),
    status:failed ? STATUS.FAIL : (degraded ? STATUS.DEGRADED : STATUS.PASS),
    stages,
    failure_stage:failed?.stage || null,
    error_code:errorCode,
    total_ms:duration(totalMs),
    bottleneck:bottleneck ? { stage:bottleneck.stage, duration_ms:bottleneck.duration_ms } : null,
    provider:safeText(aiResult?.provider || 'BONDS', 80),
    fallback_used:Boolean(nativeError && aiResult?.reply),
    fallback_reason:safeText(nativeError?.code || nativeError?.message || null),
    tool_chain:trace.slice(0, 12).map(item => ({
      action:safeText(item?.action, 80),
      status:item?.execution?.ok === true ? STATUS.PASS : STATUS.FAIL,
      error_code:safeText(item?.execution?.error?.code || null)
    })),
    evidence:research ? {
      source_count:Number.isFinite(Number(research.source_count)) ? Number(research.source_count) : null,
      evidence_count:Number.isFinite(Number(research.evidence_count)) ? Number(research.evidence_count) : null,
      decision_eligible:typeof research.decision_eligible === 'boolean' ? research.decision_eligible : null,
      unknown_count:Array.isArray(research.unknowns) ? research.unknowns.length : 0,
      contradiction_count:Array.isArray(research.contradictions) ? research.contradictions.length : 0
    } : null
  };
}

module.exports = { STATUS, buildRequestDiagnostics };
