'use strict';

const fs = require('fs');
const path = require('path');
const {
  runResearchWorkflow
} = require('../../lib/intelligence/research-workflow');
const {
  verifyEvidence,
  synthesizeResearch
} = require('../../lib/intelligence/research-intelligence');
const {
  callPreferredAI,
  calculateCost
} = require('../../lib/ai/orchestrator');

describe('Bonds mainflow intelligence integration', () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    BONDS_AI_PROVIDER: process.env.BONDS_AI_PROVIDER,
    BONDS_OPENAI_FALLBACK: process.env.BONDS_OPENAI_FALLBACK,
    BONDS_NATIVE_REMOTE_URL: process.env.BONDS_NATIVE_REMOTE_URL,
    BONDS_NATIVE_LOCAL_URL: process.env.BONDS_NATIVE_LOCAL_URL,
    BONDS_NATIVE_TOKEN: process.env.BONDS_NATIVE_TOKEN,
    BONDS_NATIVE_TIMEOUT_MS: process.env.BONDS_NATIVE_TIMEOUT_MS,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  };

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('automatic research executes explore -> verify -> synthesize and returns promoted evidence', async () => {
    const calls = [];
    const execute = async (action, input) => {
      calls.push(action);
      if (action === 'web_explore') {
        return {
          ok: true,
          executed: true,
          result: {
            pages: [
              {
                url: 'https://authority-a.example/data.json',
                evidence: { content_type: 'application/json', headers: { 'last-modified': 'Mon, 12 Oct 2026 00:00:00 GMT' } },
                extracted: { format: 'json', data: { population: 100 }, text: '{"population":100}' }
              },
              {
                url: 'https://authority-b.example/data.json',
                evidence: { content_type: 'application/json', headers: { 'last-modified': 'Mon, 12 Oct 2026 00:00:00 GMT' } },
                extracted: { format: 'json', data: { population: 100 }, text: '{"population":100}' }
              }
            ]
          },
          evidence: { coverage: { successful_count: 2 } }
        };
      }
      if (action === 'evidence_verify') return { action, ...verifyEvidence(input) };
      if (action === 'research_synthesize') return { action, ...synthesizeResearch(input) };
      throw new Error('unexpected action ' + action);
    };

    const result = await runResearchWorkflow({
      input: 'population research',
      research: {
        enabled: true,
        urls: [
          'https://authority-a.example/data.json',
          'https://authority-b.example/data.json'
        ]
      }
    }, {
      populated: [],
      manual: ['population'],
      overallConfidence: 0
    }, { executeCapability: execute });

    expect(calls).toEqual(['web_explore', 'evidence_verify', 'research_synthesize']);
    expect(result.status).toBe('SUPPORTED');
    expect(result.decisionEligible).toBe(true);
    expect(result.evidence.length).toBe(2);
    expect(result.evidence.every(item => item.validation_status === 'verified')).toBe(true);
    expect(result.evidence.every(item => item.source_type === 'VERIFIED_EXTERNAL')).toBe(true);
  });

  test('automatic research preserves contradictions and blocks decision eligibility', async () => {
    const execute = async (action, input) => {
      if (action === 'web_explore') {
        return {
          ok: true,
          executed: true,
          result: {
            pages: [
              {
                url: 'https://authority-a.example/data.json',
                evidence: { content_type: 'application/json', headers: {} },
                extracted: { format: 'json', data: { population: 100 }, text: '{"population":100}' }
              },
              {
                url: 'https://authority-b.example/data.json',
                evidence: { content_type: 'application/json', headers: {} },
                extracted: { format: 'json', data: { population: 200 }, text: '{"population":200}' }
              }
            ]
          }
        };
      }
      if (action === 'evidence_verify') return { action, ...verifyEvidence(input) };
      if (action === 'research_synthesize') return { action, ...synthesizeResearch(input) };
      throw new Error('unexpected action');
    };

    const result = await runResearchWorkflow({
      input: 'population research',
      research: {
        enabled: true,
        urls: [
          'https://authority-a.example/data.json',
          'https://authority-b.example/data.json'
        ]
      }
    }, { populated: [], manual: ['population'], overallConfidence: 0 }, { executeCapability: execute });

    expect(result.status).toBe('CONTESTED');
    expect(result.decisionEligible).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.contradictions).toHaveLength(1);
  });

  test('main orchestrator source contract wires research into decision integrity and evidence graph', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/orchestrator/intelligence-orchestrator.js'),
      'utf8'
    );
    expect(source).toContain("require('../intelligence/research-workflow')");
    expect(source).toContain('await runResearchWorkflow(request, autoPopulate');
    expect(source).toContain('...(researchWorkflow.evidence || [])');
    expect(source).toContain('researchHasConflict');
    expect(source).toContain('researchNeedsReview');
    expect(source).toContain("research_intelligence");
  });

  test('main AI uses Bonds Native first and reports zero provider cost', async () => {
    process.env.BONDS_AI_PROVIDER = 'native-first';
    process.env.BONDS_OPENAI_FALLBACK = 'false';
    process.env.BONDS_NATIVE_LOCAL_URL = 'http://127.0.0.1:8765';
    process.env.BONDS_NATIVE_TIMEOUT_MS = '1000';

    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toBe('http://127.0.0.1:8765/generate');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          result: {
            text: JSON.stringify({
              summary: 'native',
              recommendations: ['مراجعة']
            }),
            backend: 'llama_cpp',
            model_sha256: 'model-sha',
            n_gpu_layers: -1,
            gpu_offload_supported: true,
            usage: { prompt_tokens: 10, completion_tokens: 5 }
          }
        })
      };
    });

    const result = await callPreferredAI([
      { role: 'user', content: 'Return JSON' }
    ], 'gpt-5.4');

    expect(result.provider).toBe('bonds_native');
    expect(result.modelUsed).toBe('bonds-native');
    expect(result.result.summary).toBe('native');
    expect(result.inferenceMetadata.backend).toBe('llama_cpp');
    expect(result.inferenceMetadata.model_sha256).toBe('model-sha');
    expect(calculateCost(result.modelUsed, result.tokensInput, result.tokensOutput)).toBe(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('main AI falls back externally only when native is unavailable and fallback is enabled', async () => {
    process.env.BONDS_AI_PROVIDER = 'native-first';
    process.env.BONDS_OPENAI_FALLBACK = 'true';
    process.env.BONDS_NATIVE_LOCAL_URL = 'http://127.0.0.1:8765';
    process.env.BONDS_NATIVE_TIMEOUT_MS = '1000';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('127.0.0.1:8765')) {
        throw new Error('native unavailable');
      }
      expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ summary: 'fallback', recommendations: ['مراجعة'] }) } }],
          usage: { prompt_tokens: 20, completion_tokens: 10 }
        }),
        text: async () => ''
      };
    });

    const result = await callPreferredAI([
      { role: 'user', content: 'Return JSON' }
    ], 'gpt-5.4');

    expect(result.provider).toBe('openai_fallback');
    expect(result.modelUsed).toBe('gpt-5.4');
    expect(result.result.summary).toBe('fallback');
    expect(result.inferenceMetadata.native_failure).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('native-only mode fails closed instead of silently using an external provider', async () => {
    process.env.BONDS_AI_PROVIDER = 'native-only';
    process.env.BONDS_OPENAI_FALLBACK = 'true';
    process.env.BONDS_NATIVE_LOCAL_URL = 'http://127.0.0.1:8765';
    process.env.BONDS_NATIVE_TIMEOUT_MS = '1000';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    global.fetch = jest.fn(async () => {
      throw new Error('native unavailable');
    });

    await expect(callPreferredAI([
      { role: 'user', content: 'Return JSON' }
    ], 'gpt-5.4')).rejects.toThrow(/native unavailable/i);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
