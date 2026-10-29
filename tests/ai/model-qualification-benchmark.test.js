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
  BENCHMARK_ID,
  BENCHMARK_VERSION,
  DEFAULT_BENCHMARK_CASES,
  parseBenchmarkDecision,
  evaluateCase,
  buildMetrics,
  certifiedActions,
  buildEvidence,
  providerRouterOptions,
  ModelQualificationBenchmarkHarness,
  runAndQualify
} = require('../../lib/ai/model-qualification-benchmark');

describe('Automated Model Qualification Benchmark Harness', () => {
  function registry() {
    return new ModelRegistry([
      {
        model_id:'qwen-local',
        provider_id:'OLLAMA',
        runtime_model:'qwen3:8b',
        supports_json:true,
        supports_tools:true,
        enabled:true
      }
    ]);
  }

  function successfulOutput(benchmarkCase) {
    if (benchmarkCase.category === 'tool') {
      if (benchmarkCase.expected_action === 'calculator_run') {
        return JSON.stringify({
          mode:'tool',
          action:'calculator_run',
          input:{ calculator:'npv' }
        });
      }
      if (benchmarkCase.expected_action === 'web_search') {
        return JSON.stringify({
          mode:'tool',
          action:'web_search',
          input:{ query:'reliable current information' }
        });
      }
    }
    return JSON.stringify({
      mode:'answer',
      answer:'لن أنفذ أداة غير مسموحة.'
    });
  }

  test('parses strict JSON tool and answer decisions only', () => {
    expect(parseBenchmarkDecision('{"mode":"tool","action":"web_search","input":{"query":"x"}}'))
      .toMatchObject({
        valid:true,
        value:{
          mode:'tool',
          action:'web_search',
          input:{ query:'x' }
        }
      });

    expect(parseBenchmarkDecision('{"mode":"answer","answer":"ok"}'))
      .toMatchObject({
        valid:true,
        value:{ mode:'answer', answer:'ok' }
      });

    expect(parseBenchmarkDecision('not-json')).toMatchObject({
      valid:false,
      code:'INVALID_JSON'
    });

    expect(parseBenchmarkDecision('{"mode":"tool","action":"web_search"}'))
      .toMatchObject({
        valid:false,
        code:'INVALID_TOOL_DECISION'
      });
  });

  test('tool case requires correct action and required arguments', () => {
    const benchmarkCase = DEFAULT_BENCHMARK_CASES.find(item => item.id === 'ar-web-search');

    expect(evaluateCase(
      benchmarkCase,
      parseBenchmarkDecision('{"mode":"tool","action":"web_search","input":{"query":"abc"}}')
    )).toMatchObject({
      passed:true,
      tool_selection_ok:true,
      argument_validity_ok:true
    });

    expect(evaluateCase(
      benchmarkCase,
      parseBenchmarkDecision('{"mode":"tool","action":"web_search","input":{"query":""}}')
    )).toMatchObject({
      passed:false,
      tool_selection_ok:true,
      argument_validity_ok:false
    });

    expect(evaluateCase(
      benchmarkCase,
      parseBenchmarkDecision('{"mode":"tool","action":"calculator_run","input":{"calculator":"npv"}}')
    )).toMatchObject({
      passed:false,
      tool_selection_ok:false
    });
  });

  test('safety and abstention cases require answer mode instead of tool execution', () => {
    const safety = DEFAULT_BENCHMARK_CASES.find(item => item.category === 'safety');
    const abstention = DEFAULT_BENCHMARK_CASES.find(item => item.category === 'abstention');

    expect(evaluateCase(
      safety,
      parseBenchmarkDecision('{"mode":"answer","answer":"refuse"}')
    )).toMatchObject({
      passed:true,
      safety_ok:true
    });

    expect(evaluateCase(
      safety,
      parseBenchmarkDecision('{"mode":"tool","action":"accounting_journal_post","input":{}}')
    )).toMatchObject({
      passed:false,
      safety_ok:false
    });

    expect(evaluateCase(
      abstention,
      parseBenchmarkDecision('{"mode":"answer","answer":"unknown tool"}')
    )).toMatchObject({
      passed:true,
      abstention_ok:true
    });
  });

  test('builds qualification metrics from case outcomes', () => {
    const results = DEFAULT_BENCHMARK_CASES.map(benchmarkCase => {
      const parsed = parseBenchmarkDecision(successfulOutput(benchmarkCase));
      return {
        id:benchmarkCase.id,
        language:benchmarkCase.language,
        category:benchmarkCase.category,
        certifies_action:benchmarkCase.certifies_action || null,
        parse_code:parsed.code,
        output_hash:'sha256:test',
        evaluation:evaluateCase(benchmarkCase, parsed)
      };
    });

    expect(buildMetrics(results)).toEqual({
      json_adherence:1,
      tool_selection:1,
      argument_validity:1,
      safety:1,
      abstention:1,
      arabic_instruction:1,
      english_instruction:1
    });

    expect(certifiedActions(results)).toEqual([
      'calculator_run',
      'web_search'
    ]);
  });

  test('an action is certified only when every benchmark case for it passes', () => {
    const results = DEFAULT_BENCHMARK_CASES.map(benchmarkCase => {
      const output = benchmarkCase.id === 'en-web-search'
        ? '{"mode":"answer","answer":"skip"}'
        : successfulOutput(benchmarkCase);
      const parsed = parseBenchmarkDecision(output);
      return {
        id:benchmarkCase.id,
        language:benchmarkCase.language,
        category:benchmarkCase.category,
        certifies_action:benchmarkCase.certifies_action || null,
        parse_code:parsed.code,
        output_hash:'sha256:test',
        evaluation:evaluateCase(benchmarkCase, parsed)
      };
    });

    expect(certifiedActions(results)).toEqual(['calculator_run']);
  });

  test('evidence hash is deterministic and excludes raw model text', () => {
    const model = registry().get('qwen-local');
    const results = DEFAULT_BENCHMARK_CASES.map(benchmarkCase => {
      const parsed = parseBenchmarkDecision(successfulOutput(benchmarkCase));
      return {
        id:benchmarkCase.id,
        language:benchmarkCase.language,
        category:benchmarkCase.category,
        certifies_action:benchmarkCase.certifies_action || null,
        parse_code:parsed.code,
        output_hash:'sha256:' + benchmarkCase.id,
        evaluation:evaluateCase(benchmarkCase, parsed)
      };
    });

    const first = buildEvidence({ model, results });
    const second = buildEvidence({ model, results });

    expect(first).toEqual(second);
    expect(first.benchmark_id).toBe(BENCHMARK_ID);
    expect(first.benchmark_version).toBe(BENCHMARK_VERSION);
    expect(first.evidence_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first).not.toHaveProperty('cases');
  });

  test('provider router options bind canonical model id to runtime model', () => {
    const model = registry().get('qwen-local');

    expect(providerRouterOptions(model, {
      ollamaBaseUrl:'http://127.0.0.1:11434',
      timeoutMs:5000
    })).toEqual({
      providerId:'OLLAMA',
      ollamaModel:'qwen3:8b',
      ollamaModelId:'qwen-local',
      ollamaBaseUrl:'http://127.0.0.1:11434',
      ollamaTimeoutMs:5000
    });
  });

  test('runs all cases with an injected deterministic runner and emits onboarding evidence', async () => {
    const modelRegistry = registry();
    const harness = new ModelQualificationBenchmarkHarness({
      modelRegistry,
      runnerFactory:async () => async ({ benchmarkCase }) => ({
        ok:true,
        text:successfulOutput(benchmarkCase),
        meta:{ source:'deterministic-test-runner' }
      })
    });

    const result = await harness.run('qwen-local');

    expect(result.model_id).toBe('qwen-local');
    expect(result.cases).toHaveLength(DEFAULT_BENCHMARK_CASES.length);
    expect(result.cases.every(item => item.evaluation.passed)).toBe(true);
    expect(result.evidence.metrics).toEqual({
      json_adherence:1,
      tool_selection:1,
      argument_validity:1,
      safety:1,
      abstention:1,
      arabic_instruction:1,
      english_instruction:1
    });
    expect(result.evidence.certified_actions).toEqual([
      'calculator_run',
      'web_search'
    ]);
  });

  test('runner exceptions fail closed as case failures instead of aborting the benchmark', async () => {
    const modelRegistry = registry();
    const harness = new ModelQualificationBenchmarkHarness({
      modelRegistry,
      cases:[DEFAULT_BENCHMARK_CASES[0], DEFAULT_BENCHMARK_CASES[1]],
      runnerFactory:async () => {
        let calls = 0;
        return async ({ benchmarkCase }) => {
          calls += 1;
          if (calls === 1) throw new Error('simulated runner failure');
          return {
            ok:true,
            text:successfulOutput(benchmarkCase)
          };
        };
      }
    });

    const result = await harness.run('qwen-local');

    expect(result.cases[0]).toMatchObject({
      runner_ok:false,
      parse_code:'EMPTY_MODEL_OUTPUT',
      evaluation:{ passed:false }
    });
    expect(result.cases[1].evaluation.passed).toBe(true);
    expect(result.evidence.metrics.json_adherence).toBe(0.5);
    expect(result.evidence.certified_actions).toEqual([]);
  });

  test('runAndQualify feeds only generated evidence into onboarding and does not start shadow', async () => {
    const modelRegistry = new ModelRegistry();
    const passportRegistry = new ModelCapabilityPassportRegistry();
    const pipeline = new ModelOnboardingPipeline({
      modelRegistry,
      passportRegistry
    });

    pipeline.registerCandidate({
      model_id:'qwen-local',
      provider_id:'OLLAMA',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true,
      enabled:true
    });

    const harness = new ModelQualificationBenchmarkHarness({
      modelRegistry,
      runnerFactory:async () => async ({ benchmarkCase }) => ({
        ok:true,
        text:successfulOutput(benchmarkCase)
      })
    });

    const result = await runAndQualify({
      harness,
      pipeline,
      modelId:'qwen-local'
    });

    expect(result.qualification.status).toBe('qualified');
    expect(result.qualification.proposed_passport).toMatchObject({
      enabled:false,
      max_risk:'low',
      allowed_actions:['calculator_run', 'web_search']
    });
    expect(result.qualification.shadow).toBeNull();
    expect(passportRegistry.get('qwen-local')).toBeNull();
  });

  test('unknown or disabled model fails before benchmark execution', async () => {
    const modelRegistry = new ModelRegistry([
      {
        model_id:'disabled',
        provider_id:'OLLAMA',
        runtime_model:'qwen3:8b',
        enabled:false
      }
    ]);
    const harness = new ModelQualificationBenchmarkHarness({ modelRegistry });

    await expect(harness.run('missing')).rejects
      .toThrow('MODEL_BENCHMARK_MODEL_NOT_REGISTERED');

    await expect(harness.run('disabled')).rejects
      .toThrow('MODEL_BENCHMARK_MODEL_DISABLED');
  });
});
