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
  ModelLifecycleController
} = require('../../lib/ai/model-lifecycle-controller');
const {
  stateHash,
  normalizePersistedState,
  verifyPersistedState,
  MemoryModelRoutingStateStore
} = require('../../lib/ai/model-routing-state-store');
const {
  modelToProviderOptions,
  PersistentRuntimeModelRouting
} = require('../../lib/ai/runtime-model-routing');

describe('Persistent Runtime Model Routing', () => {
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

    function controller() {
      return new ModelLifecycleController({
        modelRegistry,
        passportRegistry,
        onboardingPipeline,
        initialChampion:'champion',
        policy:{
          steps:[100],
          min_samples:1,
          min_success_rate:0,
          min_safety_rate:0,
          max_critical_failures:0,
          max_error_rate:1
        }
      });
    }

    return {
      modelRegistry,
      passportRegistry,
      onboardingPipeline,
      controller
    };
  }

  test('persisted state hash is deterministic and detects tampering', () => {
    const normalized = normalizePersistedState({
      lifecycle_version:'1',
      generation:1,
      champion_model_id:'champion',
      previous_champion_model_id:null,
      canary:null,
      policy:{ steps:[100] }
    });

    const hash = stateHash(normalized);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    expect(verifyPersistedState({
      ...normalized,
      state_hash:hash
    })).toEqual(normalized);

    expect(() => verifyPersistedState({
      ...normalized,
      champion_model_id:'tampered',
      state_hash:hash
    })).toThrow('MODEL_ROUTING_STATE_HASH_MISMATCH');
  });

  test('memory state store uses optimistic revision on every write', async () => {
    const store = new MemoryModelRoutingStateStore();
    const state = {
      lifecycle_version:'1',
      generation:1,
      champion_model_id:'champion',
      previous_champion_model_id:null,
      canary:null,
      policy:{ steps:[100] }
    };

    const first = await store.save(state, { expectedRevision:0 });
    expect(first.revision).toBe(1);

    const second = await store.save(state, { expectedRevision:1 });
    expect(second.revision).toBe(2);

    await expect(store.save(state, { expectedRevision:1 }))
      .rejects.toThrow('MODEL_ROUTING_STATE_REVISION_CONFLICT');
  });

  test('lifecycle persistent state preserves raw canary metrics across restart', async () => {
    const { controller } = setup();
    const firstController = controller();
    const store = new MemoryModelRoutingStateStore();

    const runtime1 = new PersistentRuntimeModelRouting({
      lifecycleController:firstController,
      stateStore:store
    });

    await runtime1.initialize();
    await runtime1.startCanary('challenger');
    await runtime1.recordOutcome({
      model_id:'challenger',
      success:true,
      safe:true
    });

    const persistedBeforeRestart = firstController.persistentState();
    expect(persistedBeforeRestart.canary.metrics.challenger.requests).toBe(1);

    const secondController = controller();
    const runtime2 = new PersistentRuntimeModelRouting({
      lifecycleController:secondController,
      stateStore:store
    });

    const restored = await runtime2.initialize();
    expect(restored.state.canary).toMatchObject({
      challenger_model_id:'challenger',
      percentage:100,
      status:'active'
    });
    expect(secondController.persistentState().canary.metrics.challenger)
      .toMatchObject({
        requests:1,
        successes:1,
        safe:1
      });
  });

  test('runtime routing refuses use before persistent initialization', () => {
    const { controller } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore()
    });

    expect(() => runtime.selection('request-1'))
      .toThrow('RUNTIME_MODEL_ROUTING_NOT_INITIALIZED');
  });

  test('runtime router resolves champion model descriptor into provider router options', async () => {
    const { controller, modelRegistry } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore(),
      modelRegistry
    });

    await runtime.initialize();
    const routed = runtime.createRouter({ requestKey:'request-1' });

    expect(routed.selection).toMatchObject({
      model_id:'champion',
      role:'champion',
      canary:false
    });
    expect(routed.identity).toMatchObject({
      provider_id:'BONDS_NATIVE',
      model_id:'champion'
    });
  });

  test('100 percent canary routes runtime provider to challenger canonical model', async () => {
    const { controller, modelRegistry } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore(),
      modelRegistry
    });

    await runtime.initialize();
    await runtime.startCanary('challenger');

    const routed = runtime.createRouter({
      requestKey:'any-request',
      providerOverrides:{
        ollamaBaseUrl:'http://127.0.0.1:11434'
      }
    });

    expect(routed.selection).toMatchObject({
      model_id:'challenger',
      role:'challenger',
      canary:true,
      percentage:100
    });
    expect(routed.identity).toEqual({
      provider_id:'OLLAMA',
      model_id:'challenger',
      runtime_model:'qwen3:8b',
      mode:'OLLAMA'
    });
  });

  test('model descriptor mapping supports only configured provider families', () => {
    expect(modelToProviderOptions({
      model_id:'qwen-local',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b'
    })).toMatchObject({
      providerId:'OLLAMA',
      ollamaModel:'qwen3:8b',
      ollamaModelId:'qwen-local'
    });

    expect(modelToProviderOptions({
      model_id:'native',
      provider_id:'BONDS_NATIVE',
      runtime_model:'native'
    })).toMatchObject({
      providerId:'BONDS_NATIVE'
    });

    expect(() => modelToProviderOptions({
      model_id:'x',
      provider_id:'UNKNOWN',
      runtime_model:'x'
    })).toThrow('RUNTIME_MODEL_PROVIDER_UNSUPPORTED:UNKNOWN');
  });

  test('revision conflict reloads latest persisted state instead of leaving stale local mutation', async () => {
    const { controller } = setup();
    const store = new MemoryModelRoutingStateStore();

    const runtimeA = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:store
    });
    const runtimeB = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:store
    });

    await runtimeA.initialize();
    await runtimeB.initialize();

    await runtimeA.startCanary('challenger');

    await expect(runtimeB.startCanary('challenger'))
      .rejects.toThrow('MODEL_ROUTING_STATE_REVISION_CONFLICT');

    expect(runtimeB.snapshot().state.canary).toMatchObject({
      challenger_model_id:'challenger',
      status:'active'
    });
    expect(runtimeB.snapshot().revision).toBe(runtimeA.snapshot().revision);
  });
});