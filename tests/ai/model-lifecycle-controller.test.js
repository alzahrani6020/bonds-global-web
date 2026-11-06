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
  normalizePolicy,
  deterministicBucket,
  evaluateMetrics,
  ModelLifecycleController
} = require('../../lib/ai/model-lifecycle-controller');

describe('Model Promotion Canary Rollback Lifecycle Controller', () => {
  function setup() {
    const modelRegistry = new ModelRegistry([
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
      },
      {
        model_id:'unapproved',
        provider_id:'OLLAMA',
        runtime_model:'other:latest',
        enabled:true,
        supports_json:true
      }
    ]);

    const passportRegistry = new ModelCapabilityPassportRegistry([
      {
        model_id:'champion',
        enabled:true,
        certification_level:'production',
        max_risk:'low',
        allowed_actions:['calculator_run']
      },
      {
        model_id:'challenger',
        enabled:true,
        certification_level:'production-low-risk',
        max_risk:'low',
        allowed_actions:['calculator_run']
      }
    ]);

    const onboardingPipeline = new ModelOnboardingPipeline({
      modelRegistry,
      passportRegistry
    });

    onboardingPipeline.records.set('challenger', Object.freeze({
      model_id:'challenger',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      status:'production',
      qualification:null,
      proposed_passport:passportRegistry.get('challenger'),
      shadow:null,
      approval:{ approved:true, approved_by:'reviewer' },
      pipeline_version:'1'
    }));

    return {
      modelRegistry,
      passportRegistry,
      onboardingPipeline,
      controller:new ModelLifecycleController({
        modelRegistry,
        passportRegistry,
        onboardingPipeline,
        initialChampion:'champion',
        policy:{
          steps:[10, 50, 100],
          min_samples:2,
          min_success_rate:0.5,
          min_safety_rate:1,
          max_critical_failures:0,
          max_error_rate:0.5
        }
      })
    };
  }

  test('normalizes canary policy and requires final 100 percent step', () => {
    expect(normalizePolicy({
      steps:[50, 10, 100, 10],
      min_samples:5
    })).toMatchObject({
      steps:[10, 50, 100],
      min_samples:5
    });

    expect(() => normalizePolicy({
      steps:[5, 25, 50]
    })).toThrow('MODEL_CANARY_POLICY_MUST_END_AT_100');
  });

  test('deterministic routing bucket is stable for same request key', () => {
    const first = deterministicBucket('request-123');
    const second = deterministicBucket('request-123');

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(10000);
    expect(() => deterministicBucket('')).toThrow('MODEL_CANARY_REQUEST_KEY_REQUIRED');
  });

  test('cannot start canary for a model without production approval/passport', () => {
    const { controller } = setup();

    expect(() => controller.startCanary('unapproved'))
      .toThrow(/MODEL_CANARY_CHALLENGER_NOT_ELIGIBLE/);
  });

  test('starts bounded canary and routes deterministically between champion and challenger', () => {
    const { controller } = setup();

    const state = controller.startCanary('challenger');
    expect(state.canary).toMatchObject({
      challenger_model_id:'challenger',
      percentage:10,
      step_index:0,
      status:'active'
    });

    const a = controller.selectModel({ request_key:'same-key' });
    const b = controller.selectModel({ request_key:'same-key' });
    expect(a).toEqual(b);
    expect(['champion','challenger']).toContain(a.model_id);
  });

  test('critical challenger failure triggers immediate automatic rollback', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    const state = controller.recordOutcome({
      model_id:'challenger',
      success:true,
      safe:false,
      critical_failure:true,
      error:false
    });

    expect(state.canary).toBeNull();
    expect(state.champion_model_id).toBe('champion');

    const event = controller.listEvents().find(item =>
      item.type === 'canary_rolled_back'
    );
    expect(event).toMatchObject({
      challenger_model_id:'challenger',
      automatic:true,
      reason:'CANARY_CRITICAL_FAILURE_AUTO_ROLLBACK'
    });
  });

  test('canary advance requires passing evidence and explicit approver', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    expect(() => controller.advanceCanary({ approved_by:'reviewer' }))
      .toThrow('MODEL_CANARY_ADVANCE_REQUIRES_PASSING_EVIDENCE');

    for (let i = 0; i < 2; i += 1) {
      controller.recordOutcome({
        model_id:'challenger',
        success:true,
        safe:true
      });
      controller.recordOutcome({
        model_id:'champion',
        success:true,
        safe:true
      });
    }

    expect(() => controller.advanceCanary())
      .toThrow('MODEL_CANARY_ADVANCE_APPROVER_REQUIRED');

    expect(controller.advanceCanary({ approved_by:'reviewer' }).canary)
      .toMatchObject({
        percentage:50,
        step_index:1
      });
  });

  test('promotion is blocked before 100 percent canary and allowed only with passing final evidence', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    for (let step = 0; step < 2; step += 1) {
      for (let i = 0; i < 2; i += 1) {
        controller.recordOutcome({
          model_id:'challenger',
          success:true,
          safe:true
        });
        controller.recordOutcome({
          model_id:'champion',
          success:true,
          safe:true
        });
      }

      if (step === 0) {
        expect(() => controller.promote({ approved_by:'reviewer' }))
          .toThrow('MODEL_PROMOTION_REQUIRES_100_PERCENT_CANARY');
      }

      controller.advanceCanary({ approved_by:'reviewer' });
    }

    expect(controller.snapshot().canary.percentage).toBe(100);

    for (let i = 0; i < 2; i += 1) {
      controller.recordOutcome({
        model_id:'challenger',
        success:true,
        safe:true
      });
      controller.recordOutcome({
        model_id:'champion',
        success:true,
        safe:true
      });
    }

    const promoted = controller.promote({ approved_by:'reviewer' });
    expect(promoted).toMatchObject({
      champion_model_id:'challenger',
      previous_champion_model_id:'champion',
      canary:null
    });
  });

  test('manual champion rollback restores previous champion and preserves reverse rollback target', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    for (let step = 0; step < 3; step += 1) {
      for (let i = 0; i < 2; i += 1) {
        controller.recordOutcome({
          model_id:'challenger',
          success:true,
          safe:true
        });
        controller.recordOutcome({
          model_id:'champion',
          success:true,
          safe:true
        });
      }

      if (step < 2) {
        controller.advanceCanary({ approved_by:'reviewer' });
      }
    }

    controller.promote({ approved_by:'reviewer' });

    const rolledBack = controller.rollbackChampion({
      reason:'post-promotion degradation',
      approved_by:'ops-reviewer'
    });

    expect(rolledBack).toMatchObject({
      champion_model_id:'champion',
      previous_champion_model_id:'challenger'
    });
  });

  test('metric evaluation fails when challenger is worse than champion', () => {
    const result = evaluateMetrics({
      challenger:{
        requests:10,
        successes:8,
        safe:10,
        critical_failures:0,
        errors:2
      },
      champion:{
        requests:10,
        successes:10,
        safe:10,
        critical_failures:0,
        errors:0
      },
      policy:normalizePolicy({
        steps:[100],
        min_samples:5,
        min_success_rate:0.5,
        min_safety_rate:1,
        max_critical_failures:0,
        max_error_rate:0.5,
        require_not_worse_than_champion:true
      })
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some(item =>
      item.code === 'CANARY_SUCCESS_WORSE_THAN_CHAMPION'
    )).toBe(true);
    expect(result.failures.some(item =>
      item.code === 'CANARY_ERROR_RATE_WORSE_THAN_CHAMPION'
    )).toBe(true);
  });

  test('manual canary rollback leaves champion unchanged', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    const state = controller.rollback({
      reason:'operator stop',
      automatic:false
    });

    expect(state.champion_model_id).toBe('champion');
    expect(state.canary).toBeNull();
  });

  test('runtime health breach degrades canary one step instead of promoting', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    for (let i = 0; i < 2; i += 1) {
      controller.recordOutcome({
        model_id:'challenger',
        success:true,
        safe:true,
        latency_ms:10
      });
      controller.recordOutcome({
        model_id:'champion',
        success:true,
        safe:true,
        latency_ms:10
      });
    }
    controller.advanceCanary({ approved_by:'reviewer' });
    expect(controller.snapshot().canary.percentage).toBe(50);

    controller.recordOutcome({
      model_id:'challenger',
      success:false,
      safe:true,
      error:true,
      tool_failure:true,
      latency_ms:60000
    });
    const degraded = controller.recordOutcome({
      model_id:'challenger',
      success:false,
      safe:true,
      error:true,
      tool_failure:true,
      latency_ms:60000
    });

    expect(degraded.canary).toMatchObject({
      percentage:10,
      step_index:0,
      status:'active'
    });
    expect(controller.listEvents().some(item =>
      item.type === 'canary_degraded' && item.automatic === true
    )).toBe(true);
  });

  test('production champion health can automatically roll back after promotion', () => {
    const { controller } = setup();
    controller.startCanary('challenger');

    for (let step = 0; step < 3; step += 1) {
      for (let i = 0; i < 2; i += 1) {
        controller.recordOutcome({
          model_id:'challenger',
          success:true,
          safe:true,
          latency_ms:10
        });
        controller.recordOutcome({
          model_id:'champion',
          success:true,
          safe:true,
          latency_ms:10
        });
      }
      if (step < 2) controller.advanceCanary({ approved_by:'reviewer' });
    }

    controller.promote({ approved_by:'reviewer' });
    expect(controller.snapshot().champion_model_id).toBe('challenger');

    controller.recordOutcome({
      model_id:'challenger',
      success:false,
      safe:true,
      error:true,
      tool_failure:true,
      latency_ms:60000
    });
    const state = controller.recordOutcome({
      model_id:'challenger',
      success:false,
      safe:true,
      error:true,
      tool_failure:true,
      latency_ms:60000
    });

    expect(state).toMatchObject({
      champion_model_id:'champion',
      previous_champion_model_id:'challenger'
    });
    expect(controller.listEvents().some(item =>
      item.type === 'champion_rolled_back' &&
      item.automatic === true
    )).toBe(true);
  });

  test('health evaluation includes tool failure and latency thresholds', () => {
    const result = evaluateMetrics({
      challenger:{
        requests:2,
        successes:2,
        safe:2,
        critical_failures:0,
        errors:0,
        tool_failures:1,
        total_latency_ms:120000,
        max_latency_ms:60000
      },
      champion:{
        requests:2,
        successes:2,
        safe:2,
        critical_failures:0,
        errors:0,
        tool_failures:0,
        total_latency_ms:20,
        max_latency_ms:10
      },
      policy:normalizePolicy({
        steps:[100],
        min_samples:2,
        min_success_rate:0.5,
        min_safety_rate:1,
        max_error_rate:0.5,
        max_tool_failure_rate:0.1,
        max_average_latency_ms:30000,
        max_latency_vs_champion_ratio:2
      })
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some(item =>
      item.code === 'CANARY_TOOL_FAILURE_RATE_ABOVE_THRESHOLD'
    )).toBe(true);
    expect(result.failures.some(item =>
      item.code === 'CANARY_AVERAGE_LATENCY_ABOVE_THRESHOLD'
    )).toBe(true);
    expect(result.failures.some(item =>
      item.code === 'CANARY_LATENCY_WORSE_THAN_CHAMPION'
    )).toBe(true);
  });

});
