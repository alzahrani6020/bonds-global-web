'use strict';

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');
const {
  UniversalCapabilityGateway,
  capabilityCompatibility,
  describeCapability,
  discoverCapabilities,
  expandedTokens
} = require('../../lib/capabilities/universal-capability-gateway');
const {
  ModelRegistry
} = require('../../lib/ai/model-registry');

describe('Universal Capability Gateway', () => {
  beforeEach(() => {
    executeGovernedAction.mockReset();
  });

  test('describes registered capabilities without bypassing governance', () => {
    const result = describeCapability('calculator_run');

    expect(result).toMatchObject({
      action:'calculator_run',
      active:true,
      confirmation_required:false
    });
    expect(result.capability_id).toBeTruthy();
    expect(result.runtime_adapter).toBeTruthy();
    expect(result.compatibility.compatible).toBe(true);
  });

  test('keeps mutating capability confirmation metadata visible', () => {
    const result = describeCapability('accounting_journal_post');

    expect(result).toBeTruthy();
    expect(result.side_effect).toBe('database_write');
    expect(result.confirmation_required).toBe(true);
  });

  test('returns null for unknown capability descriptions', () => {
    expect(describeCapability('invented_capability')).toBeNull();
  });

  test('supports native-tool and structured-action model compatibility modes', () => {
    const registry = new ModelRegistry([
      {
        model_id:'tool-model',
        provider_id:'OLLAMA',
        supports_tools:true,
        supports_json:true
      },
      {
        model_id:'json-model',
        provider_id:'OLLAMA',
        supports_json:true
      },
      {
        model_id:'text-only',
        provider_id:'OLLAMA'
      }
    ]);

    expect(capabilityCompatibility('calculator_run', {
      model:'tool-model',
      modelRegistry:registry
    })).toMatchObject({
      compatible:true,
      mode:'native_tool'
    });

    expect(capabilityCompatibility('calculator_run', {
      model:'json-model',
      modelRegistry:registry
    })).toMatchObject({
      compatible:true,
      mode:'structured_action'
    });

    expect(capabilityCompatibility('calculator_run', {
      model:'text-only',
      modelRegistry:registry
    })).toMatchObject({
      compatible:false,
      code:'MODEL_TOOL_PROTOCOL_UNSUPPORTED'
    });
  });

  test('fails closed for unknown models', () => {
    expect(capabilityCompatibility('calculator_run', {
      model:'missing-model',
      modelRegistry:new ModelRegistry()
    })).toMatchObject({
      compatible:false,
      code:'MODEL_NOT_REGISTERED'
    });
  });

  test('discovers finance capabilities deterministically without exposing hidden ai/native actions', () => {
    const result = discoverCapabilities({
      query:'حلل المخاطر والتمويل للشركة',
      limit:12
    });

    const actions = result.capabilities.map(item => item.action);
    expect(actions.some(action => /risk|credit|funding/.test(action))).toBe(true);
    expect(actions).not.toContain('ai_reason');
    expect(actions).not.toContain('native_generate');
    expect(actions).not.toContain('native_health');
    expect(result.returned).toBeLessThanOrEqual(12);
  });

  test('Arabic aliases enrich discovery terms', () => {
    expect(expandedTokens('تحليل جدوى وتمويل')).toEqual(
      expect.arrayContaining(['feasibility', 'funding'])
    );
  });

  test('can exclude mutating capabilities from discovery', () => {
    const result = discoverCapabilities({
      query:'accounting journal post',
      includeMutating:false,
      limit:120
    });

    expect(result.capabilities.map(item => item.action))
      .not.toContain('accounting_journal_post');
  });

  test('does not treat information as a fuzzy match for form capabilities', () => {
    const result = discoverCapabilities({
      query:'Continue with the information you found.',
      limit:120
    });

    expect(result.fallback).toBe(true);
  });

  test('falls back to a bounded eligible catalog when query has no lexical match', () => {
    const result = discoverCapabilities({
      query:'عبارة لا تطابق أي وصف مسجل على الإطلاق',
      limit:7
    });

    expect(result.fallback).toBe(true);
    expect(result.returned).toBe(7);
    expect(result.total_eligible).toBeGreaterThan(7);
  });

  test('invoke delegates to the existing governed execution path only', async () => {
    executeGovernedAction.mockResolvedValue({
      ok:true,
      executed:true,
      action:'calculator_run',
      result:{ value:123 }
    });

    const gateway = new UniversalCapabilityGateway();
    const request = {
      action:'calculator_run',
      input:{ calculator:'npv', values:{} },
      req:{ headers:{} },
      user:{ id:'u1' },
      supabase:{},
      requestId:'req-1',
      runtimeContext:{ timeoutMs:5000 }
    };

    const response = await gateway.invoke(request);

    expect(response).toMatchObject({ ok:true, executed:true });
    expect(executeGovernedAction).toHaveBeenCalledTimes(1);
    expect(executeGovernedAction).toHaveBeenCalledWith(request);
  });

  test('invoke fails closed when request governance context is absent', async () => {
    const gateway = new UniversalCapabilityGateway();
    const response = await gateway.invoke({
      action:'calculator_run',
      input:{}
    });

    expect(response).toEqual({
      ok:false,
      executed:false,
      httpStatus:500,
      error:{ code:'CAPABILITY_GATEWAY_REQUEST_CONTEXT_REQUIRED' }
    });
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });
});
