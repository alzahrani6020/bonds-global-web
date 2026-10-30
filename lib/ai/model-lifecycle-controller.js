'use strict';

const crypto = require('crypto');
const {
  defaultModelRegistry
} = require('./model-registry');
const {
  defaultModelCapabilityPassportRegistry,
  validatePassportForModel
} = require('./model-capability-passport');

const LIFECYCLE_VERSION = '1';

const DEFAULT_CANARY_POLICY = Object.freeze({
  steps:Object.freeze([5, 25, 50, 100]),
  min_samples:20,
  min_success_rate:0.95,
  min_safety_rate:1,
  max_critical_failures:0,
  max_error_rate:0.05,
  max_tool_failure_rate:0.05,
  max_average_latency_ms:30000,
  max_latency_vs_champion_ratio:2,
  auto_degrade_on_runtime_breach:true,
  require_not_worse_than_champion:true
});

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number <= 0 || number > 100) return null;
  return Math.round(number * 100) / 100;
}

function normalizePolicy(input = {}) {
  const steps = [...new Set(
    (Array.isArray(input.steps) ? input.steps : DEFAULT_CANARY_POLICY.steps)
      .map(clampPercent)
      .filter(value => value !== null)
  )].sort((a, b) => a - b);

  if (!steps.length || steps[steps.length - 1] !== 100) {
    throw new Error('MODEL_CANARY_POLICY_MUST_END_AT_100');
  }

  const minSamples = Number.isInteger(Number(input.min_samples))
    ? Math.max(1, Number(input.min_samples))
    : DEFAULT_CANARY_POLICY.min_samples;

  return Object.freeze({
    steps:Object.freeze(steps),
    min_samples:minSamples,
    min_success_rate:Number.isFinite(Number(input.min_success_rate))
      ? Math.max(0, Math.min(1, Number(input.min_success_rate)))
      : DEFAULT_CANARY_POLICY.min_success_rate,
    min_safety_rate:Number.isFinite(Number(input.min_safety_rate))
      ? Math.max(0, Math.min(1, Number(input.min_safety_rate)))
      : DEFAULT_CANARY_POLICY.min_safety_rate,
    max_critical_failures:Number.isInteger(Number(input.max_critical_failures))
      ? Math.max(0, Number(input.max_critical_failures))
      : DEFAULT_CANARY_POLICY.max_critical_failures,
    max_error_rate:Number.isFinite(Number(input.max_error_rate))
      ? Math.max(0, Math.min(1, Number(input.max_error_rate)))
      : DEFAULT_CANARY_POLICY.max_error_rate,
    max_tool_failure_rate:Number.isFinite(Number(input.max_tool_failure_rate))
      ? Math.max(0, Math.min(1, Number(input.max_tool_failure_rate)))
      : DEFAULT_CANARY_POLICY.max_tool_failure_rate,
    max_average_latency_ms:Number.isFinite(Number(input.max_average_latency_ms))
      ? Math.max(1, Number(input.max_average_latency_ms))
      : DEFAULT_CANARY_POLICY.max_average_latency_ms,
    max_latency_vs_champion_ratio:Number.isFinite(Number(input.max_latency_vs_champion_ratio))
      ? Math.max(1, Number(input.max_latency_vs_champion_ratio))
      : DEFAULT_CANARY_POLICY.max_latency_vs_champion_ratio,
    auto_degrade_on_runtime_breach:input.auto_degrade_on_runtime_breach !== false,
    require_not_worse_than_champion:input.require_not_worse_than_champion !== false
  });
}

function emptyMetrics() {
  return {
    requests:0,
    successes:0,
    safe:0,
    critical_failures:0,
    errors:0,
    tool_failures:0,
    total_latency_ms:0,
    max_latency_ms:0
  };
}

function cloneMetrics(metrics) {
  return {
    requests:metrics.requests,
    successes:metrics.successes,
    safe:metrics.safe,
    critical_failures:metrics.critical_failures,
    errors:metrics.errors,
    tool_failures:metrics.tool_failures || 0,
    total_latency_ms:metrics.total_latency_ms || 0,
    max_latency_ms:metrics.max_latency_ms || 0
  };
}

function metricRates(metrics) {
  const requests = metrics.requests || 0;
  return Object.freeze({
    requests,
    success_rate:requests ? metrics.successes / requests : 0,
    safety_rate:requests ? metrics.safe / requests : 0,
    critical_failures:metrics.critical_failures,
    error_rate:requests ? metrics.errors / requests : 0,
    tool_failure_rate:requests ? (metrics.tool_failures || 0) / requests : 0,
    average_latency_ms:requests ? (metrics.total_latency_ms || 0) / requests : 0,
    max_latency_ms:metrics.max_latency_ms || 0
  });
}

function deterministicBucket(requestKey) {
  const key = clean(requestKey);
  if (!key) throw new Error('MODEL_CANARY_REQUEST_KEY_REQUIRED');
  const digest = crypto.createHash('sha256').update(key, 'utf8').digest();
  return digest.readUInt32BE(0) % 10000;
}

function isProductionEligible(modelId, {
  modelRegistry,
  passportRegistry,
  onboardingPipeline
}) {
  const id = clean(modelId);
  const model = modelRegistry.get(id);
  if (!model || model.enabled === false) {
    return { eligible:false, code:model ? 'MODEL_DISABLED' : 'MODEL_NOT_REGISTERED' };
  }

  const passportValidation = validatePassportForModel(id, {
    passportRegistry,
    modelRegistry
  });
  if (!passportValidation.valid) {
    return { eligible:false, code:passportValidation.code };
  }

  if (onboardingPipeline) {
    const record = onboardingPipeline.get(id);
    if (!record || record.status !== 'production') {
      return { eligible:false, code:'MODEL_NOT_APPROVED_FOR_PRODUCTION' };
    }
  }

  return { eligible:true, code:null };
}

function evaluateMetrics({
  challenger,
  champion,
  policy
}) {
  const challengerRates = metricRates(challenger);
  const championRates = metricRates(champion);
  const failures = [];

  if (challengerRates.critical_failures > policy.max_critical_failures) {
    failures.push({
      code:'CANARY_CRITICAL_FAILURES_EXCEEDED',
      actual:challengerRates.critical_failures,
      allowed:policy.max_critical_failures
    });
  }

  if (challengerRates.requests < policy.min_samples) {
    failures.push({
      code:'CANARY_MIN_SAMPLES_NOT_MET',
      actual:challengerRates.requests,
      required:policy.min_samples
    });
  }

  if (challengerRates.success_rate < policy.min_success_rate) {
    failures.push({
      code:'CANARY_SUCCESS_RATE_BELOW_THRESHOLD',
      actual:challengerRates.success_rate,
      required:policy.min_success_rate
    });
  }

  if (challengerRates.safety_rate < policy.min_safety_rate) {
    failures.push({
      code:'CANARY_SAFETY_RATE_BELOW_THRESHOLD',
      actual:challengerRates.safety_rate,
      required:policy.min_safety_rate
    });
  }

  if (challengerRates.error_rate > policy.max_error_rate) {
    failures.push({
      code:'CANARY_ERROR_RATE_ABOVE_THRESHOLD',
      actual:challengerRates.error_rate,
      allowed:policy.max_error_rate
    });
  }

  if (challengerRates.tool_failure_rate > policy.max_tool_failure_rate) {
    failures.push({
      code:'CANARY_TOOL_FAILURE_RATE_ABOVE_THRESHOLD',
      actual:challengerRates.tool_failure_rate,
      allowed:policy.max_tool_failure_rate
    });
  }

  if (challengerRates.average_latency_ms > policy.max_average_latency_ms) {
    failures.push({
      code:'CANARY_AVERAGE_LATENCY_ABOVE_THRESHOLD',
      actual:challengerRates.average_latency_ms,
      allowed:policy.max_average_latency_ms
    });
  }

  if (
    championRates.requests > 0 &&
    championRates.average_latency_ms > 0 &&
    challengerRates.average_latency_ms >
      championRates.average_latency_ms * policy.max_latency_vs_champion_ratio
  ) {
    failures.push({
      code:'CANARY_LATENCY_WORSE_THAN_CHAMPION',
      challenger:challengerRates.average_latency_ms,
      champion:championRates.average_latency_ms,
      allowed_ratio:policy.max_latency_vs_champion_ratio
    });
  }

  if (
    policy.require_not_worse_than_champion &&
    championRates.requests > 0
  ) {
    if (challengerRates.success_rate < championRates.success_rate) {
      failures.push({
        code:'CANARY_SUCCESS_WORSE_THAN_CHAMPION',
        challenger:challengerRates.success_rate,
        champion:championRates.success_rate
      });
    }

    if (challengerRates.safety_rate < championRates.safety_rate) {
      failures.push({
        code:'CANARY_SAFETY_WORSE_THAN_CHAMPION',
        challenger:challengerRates.safety_rate,
        champion:championRates.safety_rate
      });
    }

    if (challengerRates.error_rate > championRates.error_rate) {
      failures.push({
        code:'CANARY_ERROR_RATE_WORSE_THAN_CHAMPION',
        challenger:challengerRates.error_rate,
        champion:championRates.error_rate
      });
    }
  }

  return Object.freeze({
    passed:failures.length === 0,
    challenger:challengerRates,
    champion:championRates,
    failures:Object.freeze(failures)
  });
}

class ModelLifecycleController {
  constructor({
    modelRegistry = defaultModelRegistry,
    passportRegistry = defaultModelCapabilityPassportRegistry,
    onboardingPipeline = null,
    policy = DEFAULT_CANARY_POLICY,
    initialChampion = 'bonds-native'
  } = {}) {
    this.modelRegistry = modelRegistry;
    this.passportRegistry = passportRegistry;
    this.onboardingPipeline = onboardingPipeline;
    this.policy = normalizePolicy(policy);
    this.championModelId = clean(initialChampion);
    this.previousChampionModelId = null;
    this.canary = null;
    this.generation = 1;
    this.events = [];

    const eligibility = isProductionEligible(this.championModelId, {
      modelRegistry:this.modelRegistry,
      passportRegistry:this.passportRegistry,
      onboardingPipeline:null
    });
    if (!eligibility.eligible) {
      throw new Error('MODEL_LIFECYCLE_INITIAL_CHAMPION_NOT_ELIGIBLE');
    }

    this._event('champion_initialized', {
      champion_model_id:this.championModelId
    });
  }

  _event(type, detail = {}) {
    const event = Object.freeze({
      sequence:this.events.length + 1,
      type,
      generation:this.generation,
      ...detail
    });
    this.events.push(event);
    return event;
  }

  snapshot() {
    return Object.freeze({
      lifecycle_version:LIFECYCLE_VERSION,
      generation:this.generation,
      champion_model_id:this.championModelId,
      previous_champion_model_id:this.previousChampionModelId,
      canary:this.canary
        ? Object.freeze({
            challenger_model_id:this.canary.challengerModelId,
            percentage:this.canary.percentage,
            step_index:this.canary.stepIndex,
            status:this.canary.status,
            champion_metrics:metricRates(this.canary.metrics.champion),
            challenger_metrics:metricRates(this.canary.metrics.challenger)
          })
        : null
    });
  }

  persistentState() {
    return Object.freeze({
      lifecycle_version:LIFECYCLE_VERSION,
      generation:this.generation,
      champion_model_id:this.championModelId,
      previous_champion_model_id:this.previousChampionModelId,
      canary:this.canary
        ? Object.freeze({
            challenger_model_id:this.canary.challengerModelId,
            percentage:this.canary.percentage,
            step_index:this.canary.stepIndex,
            status:this.canary.status,
            metrics:Object.freeze({
              champion:Object.freeze(cloneMetrics(this.canary.metrics.champion)),
              challenger:Object.freeze(cloneMetrics(this.canary.metrics.challenger))
            })
          })
        : null,
      policy:this.policy
    });
  }

  restorePersistentState(state = {}) {
    if (String(state.lifecycle_version || '') !== LIFECYCLE_VERSION) {
      throw new Error('MODEL_LIFECYCLE_STATE_VERSION_MISMATCH');
    }

    const generation = Number(state.generation);
    if (!Number.isInteger(generation) || generation < 1) {
      throw new Error('MODEL_LIFECYCLE_STATE_GENERATION_INVALID');
    }

    const champion = clean(state.champion_model_id);
    const championEligibility = isProductionEligible(champion, {
      modelRegistry:this.modelRegistry,
      passportRegistry:this.passportRegistry,
      onboardingPipeline:null
    });
    if (!championEligibility.eligible) {
      throw new Error('MODEL_LIFECYCLE_RESTORE_CHAMPION_NOT_ELIGIBLE');
    }

    const previous = clean(state.previous_champion_model_id) || null;
    if (previous) {
      const previousEligibility = isProductionEligible(previous, {
        modelRegistry:this.modelRegistry,
        passportRegistry:this.passportRegistry,
        onboardingPipeline:null
      });
      if (!previousEligibility.eligible) {
        throw new Error('MODEL_LIFECYCLE_RESTORE_PREVIOUS_CHAMPION_NOT_ELIGIBLE');
      }
    }

    const restoredPolicy = normalizePolicy(state.policy || this.policy);
    let restoredCanary = null;

    if (state.canary) {
      const challenger = clean(state.canary.challenger_model_id);
      const eligibility = isProductionEligible(challenger, {
        modelRegistry:this.modelRegistry,
        passportRegistry:this.passportRegistry,
        onboardingPipeline:this.onboardingPipeline
      });
      if (!eligibility.eligible) {
        throw new Error('MODEL_LIFECYCLE_RESTORE_CHALLENGER_NOT_ELIGIBLE');
      }
      if (challenger === champion) {
        throw new Error('MODEL_LIFECYCLE_RESTORE_CANARY_EQUALS_CHAMPION');
      }

      const stepIndex = Number(state.canary.step_index);
      const percentage = Number(state.canary.percentage);
      if (
        !Number.isInteger(stepIndex) ||
        stepIndex < 0 ||
        stepIndex >= restoredPolicy.steps.length ||
        restoredPolicy.steps[stepIndex] !== percentage
      ) {
        throw new Error('MODEL_LIFECYCLE_RESTORE_CANARY_STEP_INVALID');
      }
      if (String(state.canary.status || '') !== 'active') {
        throw new Error('MODEL_LIFECYCLE_RESTORE_CANARY_STATUS_INVALID');
      }

      const metrics = state.canary.metrics || {};
      for (const role of ['champion', 'challenger']) {
        for (const key of ['requests', 'successes', 'safe', 'critical_failures', 'errors']) {
          const value = Number(metrics?.[role]?.[key]);
          if (!Number.isInteger(value) || value < 0) {
            throw new Error('MODEL_LIFECYCLE_RESTORE_METRICS_INVALID');
          }
        }
        for (const key of ['tool_failures', 'total_latency_ms', 'max_latency_ms']) {
          const raw = metrics?.[role]?.[key];
          if (raw === undefined || raw === null) continue;
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) {
            throw new Error('MODEL_LIFECYCLE_RESTORE_METRICS_INVALID');
          }
        }
      }

      restoredCanary = {
        challengerModelId:challenger,
        percentage,
        stepIndex,
        status:'active',
        metrics:{
          champion:cloneMetrics(metrics.champion),
          challenger:cloneMetrics(metrics.challenger)
        }
      };
    }

    this.policy = restoredPolicy;
    this.championModelId = champion;
    this.previousChampionModelId = previous;
    this.canary = restoredCanary;
    this.generation = generation;
    this.events = [];
    this._event('lifecycle_state_restored', {
      champion_model_id:champion,
      canary_active:Boolean(restoredCanary)
    });

    return this.snapshot();
  }

  listEvents() {
    return Object.freeze([...this.events]);
  }

  startCanary(challengerModelId) {
    if (this.canary && this.canary.status === 'active') {
      throw new Error('MODEL_CANARY_ALREADY_ACTIVE');
    }

    const challenger = clean(challengerModelId);
    if (!challenger) throw new Error('MODEL_CANARY_CHALLENGER_REQUIRED');
    if (challenger === this.championModelId) {
      throw new Error('MODEL_CANARY_CHALLENGER_MUST_DIFFER');
    }

    const eligibility = isProductionEligible(challenger, {
      modelRegistry:this.modelRegistry,
      passportRegistry:this.passportRegistry,
      onboardingPipeline:this.onboardingPipeline
    });
    if (!eligibility.eligible) {
      throw new Error('MODEL_CANARY_CHALLENGER_NOT_ELIGIBLE:' + eligibility.code);
    }

    this.canary = {
      challengerModelId:challenger,
      percentage:this.policy.steps[0],
      stepIndex:0,
      status:'active',
      metrics:{
        champion:emptyMetrics(),
        challenger:emptyMetrics()
      }
    };

    this._event('canary_started', {
      champion_model_id:this.championModelId,
      challenger_model_id:challenger,
      percentage:this.canary.percentage
    });

    return this.snapshot();
  }

  selectModel({ request_key } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      return Object.freeze({
        model_id:this.championModelId,
        role:'champion',
        canary:false,
        generation:this.generation
      });
    }

    const bucket = deterministicBucket(request_key);
    const threshold = Math.round(this.canary.percentage * 100);
    const challengerSelected = bucket < threshold;

    return Object.freeze({
      model_id:challengerSelected
        ? this.canary.challengerModelId
        : this.championModelId,
      role:challengerSelected ? 'challenger' : 'champion',
      canary:true,
      percentage:this.canary.percentage,
      generation:this.generation,
      bucket
    });
  }

  recordOutcome({
    model_id,
    success,
    safe,
    critical_failure = false,
    error = false,
    tool_failure = false,
    latency_ms = 0
  } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }

    const id = clean(model_id);
    let role = null;
    if (id === this.championModelId) role = 'champion';
    if (id === this.canary.challengerModelId) role = 'challenger';
    if (!role) throw new Error('MODEL_CANARY_OUTCOME_MODEL_MISMATCH');

    const metrics = this.canary.metrics[role];
    metrics.requests += 1;
    if (success === true) metrics.successes += 1;
    if (safe === true && critical_failure !== true) metrics.safe += 1;
    if (critical_failure === true) metrics.critical_failures += 1;
    if (error === true) metrics.errors += 1;
    if (tool_failure === true) metrics.tool_failures += 1;

    const latency = Number(latency_ms);
    if (!Number.isFinite(latency) || latency < 0) {
      throw new Error('MODEL_CANARY_OUTCOME_LATENCY_INVALID');
    }
    metrics.total_latency_ms += latency;
    metrics.max_latency_ms = Math.max(metrics.max_latency_ms, latency);

    this._event('canary_outcome_recorded', {
      model_id:id,
      role,
      success:success === true,
      safe:safe === true && critical_failure !== true,
      critical_failure:critical_failure === true,
      error:error === true,
      tool_failure:tool_failure === true,
      latency_ms:latency
    });

    if (
      role === 'challenger' &&
      metrics.critical_failures > this.policy.max_critical_failures
    ) {
      return this.rollback({
        reason:'CANARY_CRITICAL_FAILURE_AUTO_ROLLBACK',
        automatic:true
      });
    }

    if (
      role === 'challenger' &&
      this.policy.auto_degrade_on_runtime_breach &&
      metrics.requests >= this.policy.min_samples
    ) {
      const evaluation = this.evaluateCanary();
      if (!evaluation.passed) {
        return this.degradeCanary({
          reason:evaluation.failures[0]?.code || 'CANARY_RUNTIME_HEALTH_BREACH',
          automatic:true
        });
      }
    }

    return this.snapshot();
  }

  evaluateCanary() {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }

    return evaluateMetrics({
      challenger:this.canary.metrics.challenger,
      champion:this.canary.metrics.champion,
      policy:this.policy
    });
  }

  degradeCanary({ reason, automatic = false } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }

    const degradationReason = clean(reason) || 'CANARY_RUNTIME_HEALTH_BREACH';
    if (this.canary.stepIndex === 0) {
      return this.rollback({
        reason:degradationReason,
        automatic
      });
    }

    const fromPercentage = this.canary.percentage;
    this.canary.stepIndex -= 1;
    this.canary.percentage = this.policy.steps[this.canary.stepIndex];
    this.canary.metrics = {
      champion:emptyMetrics(),
      challenger:emptyMetrics()
    };

    this._event('canary_degraded', {
      challenger_model_id:this.canary.challengerModelId,
      from_percentage:fromPercentage,
      percentage:this.canary.percentage,
      reason:degradationReason,
      automatic:automatic === true
    });

    return this.snapshot();
  }

  advanceCanary({ approved_by } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }
    if (!clean(approved_by)) {
      throw new Error('MODEL_CANARY_ADVANCE_APPROVER_REQUIRED');
    }

    const evaluation = this.evaluateCanary();
    if (!evaluation.passed) {
      throw new Error('MODEL_CANARY_ADVANCE_REQUIRES_PASSING_EVIDENCE');
    }

    if (this.canary.stepIndex >= this.policy.steps.length - 1) {
      throw new Error('MODEL_CANARY_ALREADY_AT_FINAL_STEP');
    }

    this.canary.stepIndex += 1;
    this.canary.percentage = this.policy.steps[this.canary.stepIndex];
    this.canary.metrics = {
      champion:emptyMetrics(),
      challenger:emptyMetrics()
    };

    this._event('canary_advanced', {
      challenger_model_id:this.canary.challengerModelId,
      percentage:this.canary.percentage,
      approved_by:clean(approved_by)
    });

    return this.snapshot();
  }

  promote({ approved_by } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }
    if (!clean(approved_by)) {
      throw new Error('MODEL_PROMOTION_APPROVER_REQUIRED');
    }
    if (this.canary.percentage !== 100) {
      throw new Error('MODEL_PROMOTION_REQUIRES_100_PERCENT_CANARY');
    }

    const evaluation = this.evaluateCanary();
    if (!evaluation.passed) {
      throw new Error('MODEL_PROMOTION_REQUIRES_PASSING_EVIDENCE');
    }

    const oldChampion = this.championModelId;
    const newChampion = this.canary.challengerModelId;

    this.previousChampionModelId = oldChampion;
    this.championModelId = newChampion;
    this.canary.status = 'promoted';
    this.generation += 1;

    this._event('model_promoted', {
      previous_champion_model_id:oldChampion,
      champion_model_id:newChampion,
      approved_by:clean(approved_by)
    });

    this.canary = null;
    return this.snapshot();
  }

  rollback({ reason, automatic = false } = {}) {
    if (!this.canary || this.canary.status !== 'active') {
      throw new Error('MODEL_CANARY_NOT_ACTIVE');
    }

    const challenger = this.canary.challengerModelId;
    const rollbackReason = clean(reason) || 'CANARY_ROLLBACK_REQUESTED';

    this.canary.status = 'rolled_back';
    this._event('canary_rolled_back', {
      champion_model_id:this.championModelId,
      challenger_model_id:challenger,
      reason:rollbackReason,
      automatic:automatic === true
    });

    this.canary = null;
    this.generation += 1;
    return this.snapshot();
  }

  rollbackChampion({ reason, approved_by } = {}) {
    if (!this.previousChampionModelId) {
      throw new Error('MODEL_ROLLBACK_NO_PREVIOUS_CHAMPION');
    }
    if (!clean(approved_by)) {
      throw new Error('MODEL_ROLLBACK_APPROVER_REQUIRED');
    }
    if (this.canary && this.canary.status === 'active') {
      throw new Error('MODEL_ROLLBACK_BLOCKED_BY_ACTIVE_CANARY');
    }

    const current = this.championModelId;
    const previous = this.previousChampionModelId;

    const eligibility = isProductionEligible(previous, {
      modelRegistry:this.modelRegistry,
      passportRegistry:this.passportRegistry,
      onboardingPipeline:null
    });
    if (!eligibility.eligible) {
      throw new Error('MODEL_ROLLBACK_PREVIOUS_CHAMPION_NOT_ELIGIBLE');
    }

    this.championModelId = previous;
    this.previousChampionModelId = current;
    this.generation += 1;

    this._event('champion_rolled_back', {
      from_model_id:current,
      champion_model_id:previous,
      reason:clean(reason) || 'MODEL_ROLLBACK_REQUESTED',
      approved_by:clean(approved_by)
    });

    return this.snapshot();
  }
}

module.exports = {
  LIFECYCLE_VERSION,
  DEFAULT_CANARY_POLICY,
  normalizePolicy,
  metricRates,
  deterministicBucket,
  isProductionEligible,
  evaluateMetrics,
  ModelLifecycleController
};