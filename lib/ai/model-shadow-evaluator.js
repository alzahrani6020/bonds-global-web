'use strict';

const crypto = require('crypto');
const {
  defaultModelRegistry
} = require('./model-registry');
const {
  DEFAULT_SHADOW_THRESHOLDS,
  normalizeShadowEvidence,
  evaluateShadow
} = require('./model-onboarding-pipeline');

const SHADOW_EVALUATOR_VERSION = '1';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function clampScore(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function roundMetric(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return roundMetric(numerator / denominator);
}

function normalizeReplayCase(input = {}) {
  const id = clean(input.id);
  if (!id) throw new Error('MODEL_SHADOW_CASE_ID_REQUIRED');

  return Object.freeze({
    id,
    payload:input.payload === undefined ? null : input.payload,
    weight:Math.max(0.0001, Number(input.weight) || 1),
    critical:input.critical === true,
    metadata:Object.freeze({ ...(input.metadata || {}) })
  });
}

function normalizeRunnerResult(input = {}) {
  const ok = input.ok === true;
  const success = ok && input.success !== false;
  const criticalFailure = input.critical_failure === true;
  const safe = input.safe !== false && !criticalFailure;

  return Object.freeze({
    ok,
    success,
    safe,
    critical_failure:criticalFailure,
    quality_score:clampScore(
      input.quality_score,
      success ? 1 : 0
    ),
    latency_ms:Number.isFinite(Number(input.latency_ms))
      ? Math.max(0, Number(input.latency_ms))
      : null,
    error_code:clean(input.error_code) || null,
    decision_hash:clean(input.decision_hash) || null
  });
}

function weightedAverage(items, selector) {
  let numerator = 0;
  let denominator = 0;

  for (const item of items) {
    const weight = Number(item.weight) || 1;
    numerator += selector(item) * weight;
    denominator += weight;
  }

  return denominator ? roundMetric(numerator / denominator) : 0;
}

function compareCase(champion, challenger, epsilon = 0.0001) {
  if (challenger.critical_failure && !champion.critical_failure) return 'champion';
  if (champion.critical_failure && !challenger.critical_failure) return 'challenger';

  if (challenger.safe !== champion.safe) {
    return challenger.safe ? 'challenger' : 'champion';
  }

  if (challenger.success !== champion.success) {
    return challenger.success ? 'challenger' : 'champion';
  }

  const delta = challenger.quality_score - champion.quality_score;
  if (delta > epsilon) return 'challenger';
  if (delta < -epsilon) return 'champion';

  return 'tie';
}

function aggregateShadowResults(results) {
  const challenger = results.map(item => ({
    ...item.challenger,
    weight:item.weight
  }));
  const champion = results.map(item => ({
    ...item.champion,
    weight:item.weight
  }));

  const challengerSuccess = weightedAverage(challenger, item => item.success ? 1 : 0);
  const championSuccess = weightedAverage(champion, item => item.success ? 1 : 0);
  const challengerSafety = weightedAverage(challenger, item => item.safe ? 1 : 0);
  const championSafety = weightedAverage(champion, item => item.safe ? 1 : 0);
  const challengerQuality = weightedAverage(challenger, item => item.quality_score);
  const championQuality = weightedAverage(champion, item => item.quality_score);

  const challengerCritical = challenger.filter(item => item.critical_failure).length;
  const championCritical = champion.filter(item => item.critical_failure).length;

  const wins = results.filter(item => item.comparison === 'challenger').length;
  const losses = results.filter(item => item.comparison === 'champion').length;
  const ties = results.filter(item => item.comparison === 'tie').length;

  return Object.freeze({
    cases:results.length,
    challenger:Object.freeze({
      success_rate:challengerSuccess,
      safety_rate:challengerSafety,
      quality_score:challengerQuality,
      critical_failures:challengerCritical
    }),
    champion:Object.freeze({
      success_rate:championSuccess,
      safety_rate:championSafety,
      quality_score:championQuality,
      critical_failures:championCritical
    }),
    comparison:Object.freeze({
      wins,
      losses,
      ties,
      win_rate:ratio(wins, results.length),
      loss_rate:ratio(losses, results.length),
      tie_rate:ratio(ties, results.length)
    })
  });
}

function buildShadowEvidence({
  championModel,
  challengerModel,
  results,
  thresholds = DEFAULT_SHADOW_THRESHOLDS
}) {
  const aggregate = aggregateShadowResults(results);

  const hashMaterial = {
    evaluator_version:SHADOW_EVALUATOR_VERSION,
    champion_model_id:championModel.model_id,
    challenger_model_id:challengerModel.model_id,
    thresholds,
    aggregate,
    cases:results.map(item => ({
      id:item.id,
      input_hash:item.input_hash,
      comparison:item.comparison,
      champion:item.champion,
      challenger:item.challenger
    }))
  };

  return normalizeShadowEvidence({
    cases:aggregate.cases,
    success_rate:aggregate.challenger.success_rate,
    safety_rate:aggregate.challenger.safety_rate,
    critical_failures:aggregate.challenger.critical_failures,
    evidence_hash:'sha256:' + sha256(stableJson(hashMaterial)),
    notes:'automated shadow evaluation; raw replay payloads are excluded from shadow evidence'
  });
}

function championChallengerRecommendation({
  aggregate,
  shadowEvaluation
}) {
  const challenger = aggregate.challenger;
  const champion = aggregate.champion;
  const comparison = aggregate.comparison;

  const safetyNotWorse =
    challenger.safety_rate >= champion.safety_rate &&
    challenger.critical_failures <= champion.critical_failures;

  const successNotWorse =
    challenger.success_rate >= champion.success_rate;

  const qualityNotWorse =
    challenger.quality_score >= champion.quality_score;

  const notLosingHeadToHead =
    comparison.wins >= comparison.losses;

  const recommended =
    shadowEvaluation.passed === true &&
    safetyNotWorse &&
    successNotWorse &&
    qualityNotWorse &&
    notLosingHeadToHead;

  return Object.freeze({
    recommended,
    code:recommended
      ? 'CHALLENGER_ELIGIBLE_FOR_HUMAN_REVIEW'
      : 'CHALLENGER_NOT_ELIGIBLE_FOR_PROMOTION',
    automatic_promotion:false,
    safety_not_worse:safetyNotWorse,
    success_not_worse:successNotWorse,
    quality_not_worse:qualityNotWorse,
    head_to_head_not_losing:notLosingHeadToHead
  });
}

class ModelShadowEvaluationHarness {
  constructor({
    modelRegistry = defaultModelRegistry,
    cases = [],
    thresholds = DEFAULT_SHADOW_THRESHOLDS,
    runnerFactory = null
  } = {}) {
    this.modelRegistry = modelRegistry;
    this.cases = Object.freeze(
      (Array.isArray(cases) ? cases : []).map(normalizeReplayCase)
    );
    this.thresholds = Object.freeze({ ...thresholds });
    this.runnerFactory = runnerFactory;
  }

  async run({
    championModelId,
    challengerModelId,
    runner = null
  } = {}) {
    const championModel = this.modelRegistry.get(championModelId);
    const challengerModel = this.modelRegistry.get(challengerModelId);

    if (!championModel) throw new Error('MODEL_SHADOW_CHAMPION_NOT_REGISTERED');
    if (!challengerModel) throw new Error('MODEL_SHADOW_CHALLENGER_NOT_REGISTERED');
    if (championModel.enabled === false) throw new Error('MODEL_SHADOW_CHAMPION_DISABLED');
    if (challengerModel.enabled === false) throw new Error('MODEL_SHADOW_CHALLENGER_DISABLED');
    if (championModel.model_id === challengerModel.model_id) {
      throw new Error('MODEL_SHADOW_DISTINCT_MODELS_REQUIRED');
    }
    if (!this.cases.length) throw new Error('MODEL_SHADOW_CASES_REQUIRED');

    const execute = runner || (
      typeof this.runnerFactory === 'function'
        ? await this.runnerFactory({
            championModel,
            challengerModel
          })
        : null
    );

    if (typeof execute !== 'function') {
      throw new Error('MODEL_SHADOW_RUNNER_REQUIRED');
    }

    const results = [];

    for (const replayCase of this.cases) {
      const caseInputHash = 'sha256:' + sha256(stableJson(replayCase.payload));

      let championRaw;
      let challengerRaw;

      try {
        championRaw = await execute({
          role:'champion',
          model:championModel,
          replayCase
        });
      } catch (error) {
        championRaw = {
          ok:false,
          success:false,
          safe:false,
          critical_failure:replayCase.critical === true,
          error_code:'MODEL_SHADOW_RUNNER_EXCEPTION'
        };
      }

      try {
        challengerRaw = await execute({
          role:'challenger',
          model:challengerModel,
          replayCase
        });
      } catch (error) {
        challengerRaw = {
          ok:false,
          success:false,
          safe:false,
          critical_failure:replayCase.critical === true,
          error_code:'MODEL_SHADOW_RUNNER_EXCEPTION'
        };
      }

      const champion = normalizeRunnerResult(championRaw);
      const challenger = normalizeRunnerResult(challengerRaw);
      const comparison = compareCase(champion, challenger);

      results.push(Object.freeze({
        id:replayCase.id,
        weight:replayCase.weight,
        critical:replayCase.critical,
        input_hash:caseInputHash,
        champion,
        challenger,
        comparison
      }));
    }

    const frozenResults = Object.freeze(results);
    const aggregate = aggregateShadowResults(frozenResults);
    const evidence = buildShadowEvidence({
      championModel,
      challengerModel,
      results:frozenResults,
      thresholds:this.thresholds
    });
    const shadowEvaluation = evaluateShadow(evidence, this.thresholds);
    const recommendation = championChallengerRecommendation({
      aggregate,
      shadowEvaluation
    });

    return Object.freeze({
      evaluator_version:SHADOW_EVALUATOR_VERSION,
      champion_model_id:championModel.model_id,
      challenger_model_id:challengerModel.model_id,
      cases:frozenResults,
      aggregate,
      evidence,
      shadow_evaluation:shadowEvaluation,
      recommendation
    });
  }
}

async function runAndCompleteShadow({
  harness,
  pipeline,
  modelId,
  championModelId,
  runner = null
} = {}) {
  if (!harness || typeof harness.run !== 'function') {
    throw new Error('MODEL_SHADOW_HARNESS_REQUIRED');
  }
  if (!pipeline || typeof pipeline.completeShadow !== 'function') {
    throw new Error('MODEL_ONBOARDING_PIPELINE_REQUIRED');
  }

  const current = pipeline.get(modelId);
  if (!current) throw new Error('MODEL_ONBOARDING_RECORD_NOT_FOUND');
  if (current.status !== 'shadow') {
    throw new Error('MODEL_ONBOARDING_SHADOW_COMPLETION_REQUIRES_SHADOW');
  }

  const evaluation = await harness.run({
    championModelId,
    challengerModelId:modelId,
    runner
  });

  const completion = pipeline.completeShadow(
    modelId,
    evaluation.evidence
  );

  return Object.freeze({
    evaluation,
    completion
  });
}

module.exports = {
  SHADOW_EVALUATOR_VERSION,
  normalizeReplayCase,
  normalizeRunnerResult,
  compareCase,
  aggregateShadowResults,
  buildShadowEvidence,
  championChallengerRecommendation,
  ModelShadowEvaluationHarness,
  runAndCompleteShadow
};
