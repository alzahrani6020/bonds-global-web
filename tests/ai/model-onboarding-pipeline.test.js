'use strict';

const {
  ModelRegistry
} = require('../../lib/ai/model-registry');
const {
  ModelCapabilityPassportRegistry
} = require('../../lib/ai/model-capability-passport');
const {
  ModelOnboardingPipeline,
  DEFAULT_QUALIFICATION_THRESHOLDS,
  evaluateQualification,
  normalizeQualificationEvidence
} = require('../../lib/ai/model-onboarding-pipeline');
const {
  compileCapabilityExposure
} = require('../../lib/capabilities/capability-exposure-compiler');

describe('Model Onboarding & Certification Pipeline', () => {
  function setup() {
    const modelRegistry = new ModelRegistry();
    const passportRegistry = new ModelCapabilityPassportRegistry();
    const pipeline = new ModelOnboardingPipeline({
      modelRegistry,
      passportRegistry
    });
    return { modelRegistry, passportRegistry, pipeline };
  }

  function passingEvidence(overrides = {}) {
    return {
      metrics:{
        json_adherence:0.99,
        tool_selection:0.96,
        argument_validity:0.99,
        safety:1,
        abstention:0.95,
        arabic_instruction:0.96,
        english_instruction:0.96,
        ...(overrides.metrics || {})
      },
      certified_actions:[
        'calculator_run',
        'web_search',
        ...(overrides.certified_actions || [])
      ],
      benchmark_id:'tool-use-benchmark',
      benchmark_version:'1',
      evidence_hash:'sha256:abc123',
      ...overrides
    };
  }

  test('qualification evidence fails closed when any mandatory metric is missing', () => {
    const evidence = normalizeQualificationEvidence({
      metrics:{
        json_adherence:1
      },
      certified_actions:['calculator_run'],
      benchmark_id:'bench',
      benchmark_version:'1',
      evidence_hash:'sha256:x'
    });

    const result = evaluateQualification(evidence, DEFAULT_QUALIFICATION_THRESHOLDS);

    expect(result.passed).toBe(false);
    expect(result.failures.some(item =>
      item.metric === 'tool_selection' &&
      item.code === 'BENCHMARK_METRIC_MISSING'
    )).toBe(true);
  });

  test('candidate registration creates no passport and grants no capability exposure', () => {
    const { modelRegistry, passportRegistry, pipeline } = setup();

    const record = pipeline.registerCandidate({
      model_id:'qwen-local',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true,
      enabled:true
    });

    expect(record.status).toBe('registered');
    expect(modelRegistry.get('qwen-local')).not.toBeNull();
    expect(passportRegistry.get('qwen-local')).toBeNull();

    expect(compileCapabilityExposure({
      action:'calculator_run',
      active:true,
      sideEffect:'compute'
    }, {
      model:'qwen-local',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:false,
      code:'MODEL_CAPABILITY_PASSPORT_NOT_FOUND'
    });
  });

  test('failed benchmark remains fail-closed and cannot enter shadow', () => {
    const { pipeline, passportRegistry } = setup();

    pipeline.registerCandidate({
      model_id:'weak-model',
      provider_id:'OLLAMA',
      runtime_model:'weak:latest',
      supports_json:true
    });

    const failed = pipeline.qualify('weak-model', passingEvidence({
      metrics:{ safety:0.5 }
    }));

    expect(failed.status).toBe('qualification_failed');
    expect(failed.proposed_passport).toBeNull();
    expect(passportRegistry.get('weak-model')).toBeNull();

    expect(() => pipeline.startShadow('weak-model', {
      shadow_id:'shadow-1'
    })).toThrow('MODEL_ONBOARDING_SHADOW_REQUIRES_QUALIFIED');
  });

  test('passing qualification proposes a disabled low-risk passport but does not register it', () => {
    const { pipeline, passportRegistry } = setup();

    pipeline.registerCandidate({
      model_id:'qualified-model',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true
    });

    const qualified = pipeline.qualify('qualified-model', passingEvidence());

    expect(qualified.status).toBe('qualified');
    expect(qualified.proposed_passport).toMatchObject({
      model_id:'qualified-model',
      enabled:false,
      certification_level:'qualified-low-risk',
      max_risk:'low',
      allowed_actions:['calculator_run', 'web_search']
    });
    expect(passportRegistry.get('qualified-model')).toBeNull();
  });

  test('production approval requires shadow plus explicit human approval', () => {
    const { pipeline, passportRegistry } = setup();

    pipeline.registerCandidate({
      model_id:'approval-model',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true
    });
    pipeline.qualify('approval-model', passingEvidence());

    expect(() => pipeline.approveProduction('approval-model', {
      approved:true,
      approved_by:'reviewer'
    })).toThrow('MODEL_ONBOARDING_PRODUCTION_REQUIRES_SHADOW');

    pipeline.startShadow('approval-model', {
      shadow_id:'shadow-run-17'
    });

    expect(() => pipeline.approveProduction('approval-model', {
      approved:false,
      approved_by:'reviewer'
    })).toThrow('MODEL_ONBOARDING_EXPLICIT_APPROVAL_REQUIRED');

    expect(passportRegistry.get('approval-model')).toBeNull();
  });

  test('approved production passport exposes only benchmark-certified low-risk actions', () => {
    const { modelRegistry, passportRegistry, pipeline } = setup();

    pipeline.registerCandidate({
      model_id:'prod-model',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true
    });
    pipeline.qualify('prod-model', passingEvidence({
      certified_actions:['calculator_run']
    }));
    pipeline.startShadow('prod-model', {
      shadow_id:'shadow-prod-1',
      notes:'validated in isolated shadow'
    });

    const production = pipeline.approveProduction('prod-model', {
      approved:true,
      approved_by:'human-reviewer',
      approval_reference:'APP-42'
    });

    expect(production.status).toBe('production');
    expect(passportRegistry.get('prod-model')).toMatchObject({
      enabled:true,
      certification_level:'production-low-risk',
      max_risk:'low',
      allowed_actions:['calculator_run', 'web_search']
    });

    expect(compileCapabilityExposure({
      action:'calculator_run',
      active:true,
      sideEffect:'compute'
    }, {
      model:'prod-model',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:true,
      model_id:'prod-model'
    });

    expect(compileCapabilityExposure({
      action:'accounting_journal_post',
      active:true,
      sideEffect:'database_write'
    }, {
      model:'prod-model',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:false,
      code:'MODEL_RISK_TIER_EXCEEDED'
    });

    expect(compileCapabilityExposure({
      action:'unbenchmarked_read',
      active:true,
      sideEffect:'database_read'
    }, {
      model:'prod-model',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:false,
      code:'MODEL_CAPABILITY_NOT_CERTIFIED'
    });
  });

  test('cannot overwrite an existing model passport during approval', () => {
    const { pipeline, passportRegistry } = setup();

    pipeline.registerCandidate({
      model_id:'duplicate-passport-model',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true
    });
    pipeline.qualify('duplicate-passport-model', passingEvidence());
    pipeline.startShadow('duplicate-passport-model', {
      shadow_id:'shadow-dup'
    });

    passportRegistry.register({
      model_id:'duplicate-passport-model',
      enabled:false,
      max_risk:'low',
      allowed_actions:['calculator_run']
    });

    expect(() => pipeline.approveProduction('duplicate-passport-model', {
      approved:true,
      approved_by:'reviewer'
    })).toThrow('MODEL_CAPABILITY_PASSPORT_ALREADY_REGISTERED');
  });
});
