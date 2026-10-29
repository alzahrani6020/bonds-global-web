'use strict';

const {
  ModelRegistry
} = require('../../lib/ai/model-registry');
const {
  ModelCapabilityPassportRegistry
} = require('../../lib/ai/model-capability-passport');
const {
  ModelOnboardingPipeline
} = require('../../lib/ai/model-onboarding-pipeline');
const {
  normalizeReplayCase,
  normalizeRunnerResult,
  compareCase,
  aggregateShadowResults,
  buildShadowEvidence,
  championChallengerRecommendation,
  ModelShadowEvaluationHarness,
  runAndCompleteShadow
} = require('../../lib/ai/model-shadow-evaluator');

describe('Automated Shadow Evaluation & Champion/Challenger', () => {
  function modelRegistry() {
    return new ModelRegistry([
      {
        model_id:'champion',
        provider_id:'BONDS_NATIVE',
        runtime_model:'bonds-native',
        enabled:true,
        supports_json:true
      },
      {
        model_id:'challenger',
        provider_id:'OLLAMA',
        runtime_model:'qwen3:8b',
        enabled:true,
        supports_json:true,
        supports_tools:true
      }
    ]);
  }

  function replayCases(count = 24) {
    return Array.from({ length:count }, (_, index) => ({
      id:'case-' + String(index + 1),
      payload:{
        user_text:'sensitive replay content ' + String(index + 1),
        amount:index + 100
      },
      weight:1,
      critical:index === 0
    }));
  }

  test('normalizes replay cases and requires a stable id', () => {
    expect(normalizeReplayCase({
      id:'x',
      payload:{ a:1 },
      weight:2,
      critical:true
    })).toMatchObject({
      id:'x',
      payload:{ a:1 },
      weight:2,
      critical:true
    });

    expect(() => normalizeReplayCase({ payload:{} }))
      .toThrow('MODEL_SHADOW_CASE_ID_REQUIRED');
  });

  test('normalizes runner results conservatively', () => {
    expect(normalizeRunnerResult({
      ok:true,
      success:true,
      safe:true,
      quality_score:0.97,
      latency_ms:120
    })).toEqual({
      ok:true,
      success:true,
      safe:true,
      critical_failure:false,
      quality_score:0.97,
      latency_ms:120,
      error_code:null,
      decision_hash:null
    });

    expect(normalizeRunnerResult({
      ok:false,
      success:true
    })).toMatchObject({
      ok:false,
      success:false,
      safe:true,
      quality_score:0
    });
  });

  test('safety regression overrides quality gains in head-to-head comparison', () => {
    const champion = normalizeRunnerResult({
      ok:true,
      success:true,
      safe:true,
      quality_score:0.80
    });
    const challenger = normalizeRunnerResult({
      ok:true,
      success:true,
      safe:false,
      quality_score:1
    });

    expect(compareCase(champion, challenger)).toBe('champion');
  });

  test('aggregates champion and challenger outcomes deterministically', () => {
    const results = [
      {
        id:'1',
        weight:1,
        champion:normalizeRunnerResult({ ok:true, success:true, safe:true, quality_score:0.8 }),
        challenger:normalizeRunnerResult({ ok:true, success:true, safe:true, quality_score:0.9 }),
        comparison:'challenger'
      },
      {
        id:'2',
        weight:1,
        champion:normalizeRunnerResult({ ok:true, success:true, safe:true, quality_score:0.8 }),
        challenger:normalizeRunnerResult({ ok:true, success:false, safe:true, quality_score:0.2 }),
        comparison:'champion'
      }
    ];

    expect(aggregateShadowResults(results)).toEqual({
      cases:2,
      challenger:{
        success_rate:0.5,
        safety_rate:1,
        quality_score:0.55,
        critical_failures:0
      },
      champion:{
        success_rate:1,
        safety_rate:1,
        quality_score:0.8,
        critical_failures:0
      },
      comparison:{
        wins:1,
        losses:1,
        ties:0,
        win_rate:0.5,
        loss_rate:0.5,
        tie_rate:0
      }
    });
  });

  test('shadow evidence excludes raw replay payloads and contains deterministic hash', () => {
    const registry = modelRegistry();
    const champion = registry.get('champion');
    const challenger = registry.get('challenger');

    const results = replayCases(20).map((item, index) => ({
      id:item.id,
      weight:1,
      critical:item.critical,
      input_hash:'sha256:input-' + String(index),
      champion:normalizeRunnerResult({ ok:true, success:true, safe:true, quality_score:0.90 }),
      challenger:normalizeRunnerResult({ ok:true, success:true, safe:true, quality_score:0.95 }),
      comparison:'challenger'
    }));

    const first = buildShadowEvidence({
      championModel:champion,
      challengerModel:challenger,
      results
    });
    const second = buildShadowEvidence({
      championModel:champion,
      challengerModel:challenger,
      results
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      cases:20,
      success_rate:1,
      safety_rate:1,
      critical_failures:0
    });
    expect(first.evidence_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.notes).not.toContain('sensitive replay content');
  });

  test('recommendation never performs automatic promotion', () => {
    const aggregate = {
      challenger:{
        success_rate:1,
        safety_rate:1,
        quality_score:0.95,
        critical_failures:0
      },
      champion:{
        success_rate:0.98,
        safety_rate:1,
        quality_score:0.90,
        critical_failures:0
      },
      comparison:{
        wins:15,
        losses:5,
        ties:0
      }
    };

    expect(championChallengerRecommendation({
      aggregate,
      shadowEvaluation:{ passed:true }
    })).toMatchObject({
      recommended:true,
      code:'CHALLENGER_ELIGIBLE_FOR_HUMAN_REVIEW',
      automatic_promotion:false
    });
  });

  test('harness produces passed shadow evidence when challenger is safe and not worse', async () => {
    const harness = new ModelShadowEvaluationHarness({
      modelRegistry:modelRegistry(),
      cases:replayCases(24),
      runnerFactory:async () => async ({ role, replayCase }) => {
        if (role === 'champion') {
          return {
            ok:true,
            success:true,
            safe:true,
            quality_score:0.90,
            latency_ms:200,
            decision_hash:'champion-' + replayCase.id
          };
        }

        return {
          ok:true,
          success:true,
          safe:true,
          quality_score:0.95,
          latency_ms:180,
          decision_hash:'challenger-' + replayCase.id
        };
      }
    });

    const result = await harness.run({
      championModelId:'champion',
      challengerModelId:'challenger'
    });

    expect(result.shadow_evaluation.passed).toBe(true);
    expect(result.recommendation).toMatchObject({
      recommended:true,
      automatic_promotion:false
    });
    expect(result.evidence).toMatchObject({
      cases:24,
      success_rate:1,
      safety_rate:1,
      critical_failures:0
    });
    expect(result.cases[0]).not.toHaveProperty('payload');
    expect(result.cases[0].input_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('challenger safety regression blocks recommendation and shadow completion threshold', async () => {
    const harness = new ModelShadowEvaluationHarness({
      modelRegistry:modelRegistry(),
      cases:replayCases(24),
      runnerFactory:async () => async ({ role, replayCase }) => {
        if (role === 'champion') {
          return {
            ok:true,
            success:true,
            safe:true,
            quality_score:0.90
          };
        }

        if (replayCase.id === 'case-1') {
          return {
            ok:true,
            success:true,
            safe:false,
            critical_failure:true,
            quality_score:1
          };
        }

        return {
          ok:true,
          success:true,
          safe:true,
          quality_score:0.96
        };
      }
    });

    const result = await harness.run({
      championModelId:'champion',
      challengerModelId:'challenger'
    });

    expect(result.shadow_evaluation.passed).toBe(false);
    expect(result.aggregate.challenger.critical_failures).toBe(1);
    expect(result.recommendation).toMatchObject({
      recommended:false,
      automatic_promotion:false
    });
  });

  test('runAndCompleteShadow feeds only generated shadow evidence into onboarding', async () => {
    const registry = modelRegistry();
    const passportRegistry = new ModelCapabilityPassportRegistry();
    const pipeline = new ModelOnboardingPipeline({
      modelRegistry:registry,
      passportRegistry
    });

    pipeline.records.set('challenger', Object.freeze({
      model_id:'challenger',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      status:'qualified',
      qualification:{ evidence:{}, evaluation:{ passed:true } },
      proposed_passport:Object.freeze({
        model_id:'challenger',
        enabled:false,
        certification_level:'qualified-low-risk',
        max_risk:'low',
        allowed_actions:Object.freeze(['calculator_run']),
        denied_actions:Object.freeze([]),
        allowed_action_types:Object.freeze([]),
        allowed_side_effects:Object.freeze(['none', 'compute']),
        metadata:Object.freeze({})
      }),
      shadow:null,
      approval:null,
      pipeline_version:'1'
    }));

    pipeline.startShadow('challenger', {
      shadow_id:'shadow-001'
    });

    const harness = new ModelShadowEvaluationHarness({
      modelRegistry:registry,
      cases:replayCases(24),
      runnerFactory:async () => async ({ role }) => ({
        ok:true,
        success:true,
        safe:true,
        quality_score:role === 'challenger' ? 0.96 : 0.90
      })
    });

    const result = await runAndCompleteShadow({
      harness,
      pipeline,
      modelId:'challenger',
      championModelId:'champion'
    });

    expect(result.completion.status).toBe('shadow_passed');
    expect(result.completion.approval).toBeNull();
    expect(passportRegistry.get('challenger')).toBeNull();
  });

  test('runAndCompleteShadow refuses to bypass onboarding state', async () => {
    const registry = modelRegistry();
    const pipeline = new ModelOnboardingPipeline({
      modelRegistry:registry,
      passportRegistry:new ModelCapabilityPassportRegistry()
    });

    const harness = new ModelShadowEvaluationHarness({
      modelRegistry:registry,
      cases:replayCases(24),
      runnerFactory:async () => async () => ({
        ok:true,
        success:true,
        safe:true,
        quality_score:1
      })
    });

    await expect(runAndCompleteShadow({
      harness,
      pipeline,
      modelId:'challenger',
      championModelId:'champion'
    })).rejects.toThrow('MODEL_ONBOARDING_RECORD_NOT_FOUND');
  });
});
