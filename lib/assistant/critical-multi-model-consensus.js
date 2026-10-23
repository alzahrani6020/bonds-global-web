'use strict';

const { getInferenceRouter } = require('../ai/inference-router');
const { normalizeAction } = require('./protocol');
const { actionFingerprint } = require('./confirmation-engine');

const CRITICAL_CONSENSUS_VERSION = 1;
const MAX_CONSENSUS_REVIEWERS = 3;
const CONSENSUS_VERDICTS = Object.freeze(['approve','reject','uncertain']);

function clean(value, max = 160) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function baseConsensus(action = null) {
  return {
    version: CRITICAL_CONSENSUS_VERSION,
    type: 'critical_multi_model_consensus',
    status: 'not_available',
    verdict: 'not_available',
    critical: false,
    action_id: clean(action?.id, 160),
    action_fingerprint: null,
    reviewer_count: 0,
    distinct_model_count: 0,
    reviews: [],
    advisory_only: true,
    human_review_required: true,
    execution_authorized: false,
    auto_execute: false,
    authorization_source: false,
    model_used: false,
    multi_model: false,
    reason: null
  };
}

function safeInputKeys(action) {
  const input = action?.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.keys(input)
    .map(key => clean(key, 80))
    .filter(Boolean)
    .sort()
    .slice(0, 32);
}

function buildCriticalReviewPrompt(action) {
  const normalized = normalizeAction(action);
  const structural = {
    action_id: normalized.id,
    type: normalized.type,
    capability: normalized.capability,
    target: normalized.target,
    risk: normalized.risk,
    requires_confirmation: normalized.requires_confirmation,
    input_keys: safeInputKeys(normalized),
    action_fingerprint: actionFingerprint(normalized)
  };

  return [
    'You are an independent safety reviewer for a governed BONDS structured action.',
    'Review only the structural action metadata below. Input values are intentionally withheld.',
    'Return exactly one JSON object and no prose:',
    '{"verdict":"approve|reject|uncertain","reason_codes":["SHORT_CODE"]}',
    'approve = structurally coherent for human review; reject = structurally unsafe or contradictory; uncertain = insufficient evidence.',
    'This review is advisory only and never authorizes execution.',
    JSON.stringify(structural)
  ].join('\n');
}

function parseReviewText(value) {
  const raw = clean(value, 4000);
  if (!raw) return null;

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (_error) {
    return null;
  }

  const verdict = clean(parsed?.verdict, 20)?.toLowerCase();
  if (!CONSENSUS_VERDICTS.includes(verdict)) return null;

  const reasonCodes = Array.isArray(parsed?.reason_codes)
    ? parsed.reason_codes
        .map(code => clean(code, 80))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    verdict,
    reason_codes: reasonCodes
  };
}

function runtimeResult(response) {
  const envelope = response?.result || {};
  return envelope?.result || envelope;
}

function reviewFromResponse(response, nodeId = null) {
  if (!response?.ok) {
    return {
      ok: false,
      node: clean(nodeId, 80),
      model_sha256: null,
      verdict: null,
      reason_codes: [],
      error_code: clean(response?.error?.code || 'CONSENSUS_REVIEW_FAILED', 100)
    };
  }

  const result = runtimeResult(response);
  const parsed = parseReviewText(result?.text);
  const modelSha = clean(result?.model_sha256, 128);

  if (!parsed) {
    return {
      ok: false,
      node: clean(nodeId, 80),
      model_sha256: modelSha,
      verdict: null,
      reason_codes: [],
      error_code: 'CONSENSUS_REVIEW_INVALID_RESPONSE'
    };
  }

  if (!modelSha) {
    return {
      ok: false,
      node: clean(nodeId, 80),
      model_sha256: null,
      verdict: parsed.verdict,
      reason_codes: parsed.reason_codes,
      error_code: 'CONSENSUS_MODEL_IDENTITY_MISSING'
    };
  }

  return {
    ok: true,
    node: clean(nodeId, 80),
    model_sha256: modelSha,
    verdict: parsed.verdict,
    reason_codes: parsed.reason_codes,
    error_code: null
  };
}

function aggregateCriticalConsensus({ action, reviews = [] } = {}) {
  const consensus = baseConsensus(action);

  let normalized;
  try {
    normalized = normalizeAction(action);
  } catch (error) {
    consensus.reason = clean(error?.message || 'INVALID_ASSISTANT_ACTION', 100);
    return consensus;
  }

  consensus.action_id = normalized.id;
  consensus.action_fingerprint = actionFingerprint(normalized);
  consensus.critical = normalized.risk === 'critical';

  if (!consensus.critical) {
    consensus.status = 'not_applicable';
    consensus.verdict = 'not_applicable';
    consensus.reason = 'CRITICAL_CONSENSUS_NOT_APPLICABLE';
    return consensus;
  }

  const successful = (Array.isArray(reviews) ? reviews : [])
    .filter(review => review?.ok && review?.model_sha256 && CONSENSUS_VERDICTS.includes(review?.verdict));

  consensus.model_used = successful.length > 0;

  const byModel = new Map();
  for (const review of successful) {
    if (!byModel.has(review.model_sha256)) byModel.set(review.model_sha256, review);
  }

  const distinct = [...byModel.values()].slice(0, MAX_CONSENSUS_REVIEWERS);
  consensus.reviewer_count = successful.length;
  consensus.distinct_model_count = distinct.length;
  consensus.multi_model = distinct.length >= 2;
  consensus.reviews = distinct.map(review => ({
    model_ref: String(review.model_sha256).slice(0, 16),
    verdict: review.verdict,
    reason_codes: Array.isArray(review.reason_codes) ? review.reason_codes.slice(0, 8) : []
  }));

  if (distinct.length < 2) {
    consensus.reason = 'DISTINCT_MODEL_REQUIREMENT_NOT_MET';
    return consensus;
  }

  const verdicts = distinct.map(review => review.verdict);
  if (verdicts.every(verdict => verdict === 'approve')) {
    consensus.status = 'completed';
    consensus.verdict = 'consensus_approve_for_review';
  } else if (verdicts.every(verdict => verdict === 'reject')) {
    consensus.status = 'completed';
    consensus.verdict = 'consensus_reject_for_review';
  } else {
    consensus.status = 'completed';
    consensus.verdict = 'no_consensus';
  }

  return consensus;
}

function publicCriticalConsensus(consensus) {
  if (!consensus || typeof consensus !== 'object') return null;
  return {
    version: Number(consensus.version) || CRITICAL_CONSENSUS_VERSION,
    type: 'critical_multi_model_consensus',
    status: clean(consensus.status, 40),
    verdict: clean(consensus.verdict, 60),
    critical: Boolean(consensus.critical),
    action_id: clean(consensus.action_id, 160),
    action_fingerprint: clean(consensus.action_fingerprint, 64),
    reviewer_count: Math.max(0, Number(consensus.reviewer_count) || 0),
    distinct_model_count: Math.max(0, Number(consensus.distinct_model_count) || 0),
    reviews: Array.isArray(consensus.reviews)
      ? consensus.reviews.slice(0, MAX_CONSENSUS_REVIEWERS).map(review => ({
          model_ref: clean(review?.model_ref, 16),
          verdict: clean(review?.verdict, 20),
          reason_codes: Array.isArray(review?.reason_codes)
            ? review.reason_codes.map(code => clean(code, 80)).filter(Boolean).slice(0, 8)
            : []
        }))
      : [],
    advisory_only: true,
    human_review_required: true,
    execution_authorized: false,
    auto_execute: false,
    authorization_source: false,
    model_used: Boolean(consensus.model_used),
    multi_model: Boolean(consensus.multi_model),
    reason: clean(consensus.reason, 100)
  };
}

async function reviewCriticalAction({
  action,
  router = null,
  routerFactory = getInferenceRouter
} = {}) {
  let normalized;
  try {
    normalized = normalizeAction(action);
  } catch (error) {
    return publicCriticalConsensus({
      ...baseConsensus(action),
      reason: clean(error?.message || 'INVALID_ASSISTANT_ACTION', 100)
    });
  }

  if (normalized.risk !== 'critical') {
    return publicCriticalConsensus(aggregateCriticalConsensus({ action: normalized, reviews: [] }));
  }

  const inferenceRouter = router || routerFactory({ latencyAwareRouting: true });

  if (
    inferenceRouter?.mode !== 'REMOTE_BONDS_NATIVE' ||
    typeof inferenceRouter?._candidateRemoteProviders !== 'function'
  ) {
    return publicCriticalConsensus({
      ...aggregateCriticalConsensus({ action: normalized, reviews: [] }),
      reason: 'MULTI_MODEL_RUNTIME_NOT_CONFIGURED'
    });
  }

  let candidates;
  try {
    candidates = inferenceRouter
      ._candidateRemoteProviders('generate')
      .slice(0, MAX_CONSENSUS_REVIEWERS);
  } catch (_error) {
    candidates = [];
  }

  if (candidates.length < 2) {
    return publicCriticalConsensus({
      ...aggregateCriticalConsensus({ action: normalized, reviews: [] }),
      reason: 'MULTI_MODEL_RUNTIME_NOT_CONFIGURED'
    });
  }

  const prompt = buildCriticalReviewPrompt(normalized);
  const reviews = await Promise.all(candidates.map(async node => {
    try {
      const response = await node.provider.generate(prompt, { temperature: 0 });
      return reviewFromResponse(response, node.id);
    } catch (error) {
      return {
        ok: false,
        node: clean(node?.id, 80),
        model_sha256: null,
        verdict: null,
        reason_codes: [],
        error_code: clean(error?.message || 'CONSENSUS_REVIEW_FAILED', 100)
      };
    }
  }));

  return publicCriticalConsensus(aggregateCriticalConsensus({
    action: normalized,
    reviews
  }));
}

module.exports = {
  CRITICAL_CONSENSUS_VERSION,
  MAX_CONSENSUS_REVIEWERS,
  CONSENSUS_VERDICTS,
  buildCriticalReviewPrompt,
  parseReviewText,
  reviewFromResponse,
  aggregateCriticalConsensus,
  publicCriticalConsensus,
  reviewCriticalAction
};
