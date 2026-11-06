'use strict';

const {
  ModelRegistry
} = require('../../lib/ai/model-registry');
const {
  ModelCapabilityPassportRegistry,
  normalizePassport,
  validatePassportForModel
} = require('../../lib/ai/model-capability-passport');
const {
  capabilityRisk,
  capabilityHealth,
  capabilityActionType,
  trustedGovernanceAllows,
  compileCapabilityExposure
} = require('../../lib/capabilities/capability-exposure-compiler');
const {
  discoverCapabilities
} = require('../../lib/capabilities/universal-capability-gateway');

describe('Model Capability Passport and Exposure Compiler', () => {
  function registries() {
    const modelRegistry = new ModelRegistry([
      {
        model_id:'ollama-tool',
        provider_id:'OLLAMA',
        supports_tools:true,
        supports_json:true,
        enabled:true
      },
      {
        model_id:'ollama-json',
        provider_id:'OLLAMA',
        supports_json:true,
        enabled:true
      }
    ]);

    const passportRegistry = new ModelCapabilityPassportRegistry([
      {
        model_id:'ollama-tool',
        certification_level:'controlled',
        max_risk:'medium',
        allowed_actions:['calculator_run', 'accounting_journal_post']
      },
      {
        model_id:'ollama-json',
        certification_level:'read-only',
        max_risk:'low',
        allowed_side_effects:['none', 'network_read', 'database_read', 'compute']
      }
    ]);

    return { modelRegistry, passportRegistry };
  }

  test('normalizes passport deterministically', () => {
    expect(normalizePassport({
      model_id:'m1',
      max_risk:'HIGH',
      allowed_actions:['b', 'a', 'a'],
      denied_actions:['z']
    })).toMatchObject({
      model_id:'m1',
      max_risk:'high',
      allowed_actions:['a', 'b'],
      denied_actions:['z']
    });
  });

  test('passport validation fails closed for unknown model', () => {
    const passportRegistry = new ModelCapabilityPassportRegistry([
      { model_id:'missing', max_risk:'low' }
    ]);

    expect(validatePassportForModel('missing', {
      passportRegistry,
      modelRegistry:new ModelRegistry()
    })).toMatchObject({
      valid:false,
      code:'MODEL_NOT_REGISTERED'
    });
  });

  test('classifies capability action type without registry coupling', () => {
    expect(capabilityActionType({ actionType:'workflow' })).toBe('workflow');
    expect(capabilityActionType({ sideEffect:'network_read' })).toBe('api');
    expect(capabilityActionType({ sideEffect:'database_write' })).toBe('data');
    expect(capabilityActionType({ sideEffect:'compute' })).toBe('engine');
    expect(capabilityActionType({})).toBe('capability');
  });

  test('derives conservative capability risk from side effects', () => {
    expect(capabilityRisk({ sideEffect:'none' })).toBe('low');
    expect(capabilityRisk({ sideEffect:'database_write' })).toBe('medium');
    expect(capabilityRisk({ sideEffect:'network_write' })).toBe('high');
    expect(capabilityRisk({ risk_level:'critical', sideEffect:'none' })).toBe('critical');
  });

  test('health fails closed for unknown status', () => {
    expect(capabilityHealth({ active:true }, { status:'healthy' })).toBe('healthy');
    expect(capabilityHealth({ active:true }, { status:'mystery' })).toBe('unavailable');
  });

  test('trusted governance context never infers missing permissions', () => {
    const capability = {
      required_permissions:['finance.write'],
      required_roles:['analyst']
    };

    expect(trustedGovernanceAllows(capability, null)).toEqual({
      allowed:true,
      code:null,
      checked:false
    });

    expect(trustedGovernanceAllows(capability, {
      authenticated:true,
      permissions:[],
      roles:['analyst']
    })).toMatchObject({
      allowed:false,
      code:'CAPABILITY_PERMISSION_NOT_EXPOSED',
      checked:true
    });
  });

  test('exposes only capabilities certified by model passport and risk tier', () => {
    const { modelRegistry, passportRegistry } = registries();

    expect(compileCapabilityExposure({
      action:'calculator_run',
      active:true,
      sideEffect:'compute'
    }, {
      model:'ollama-tool',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:true,
      model_id:'ollama-tool',
      risk:'low',
      certification_level:'controlled'
    });

    expect(compileCapabilityExposure({
      action:'dangerous_external_write',
      active:true,
      sideEffect:'network_write'
    }, {
      model:'ollama-tool',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:false,
      code:'MODEL_RISK_TIER_EXCEEDED'
    });

    expect(compileCapabilityExposure({
      action:'unlisted_read',
      active:true,
      sideEffect:'database_read'
    }, {
      model:'ollama-tool',
      modelRegistry,
      passportRegistry
    })).toMatchObject({
      exposed:false,
      code:'MODEL_CAPABILITY_NOT_CERTIFIED'
    });
  });

  test('degraded capabilities remain exposable while unavailable capabilities do not', () => {
    const { modelRegistry, passportRegistry } = registries();
    const capability = {
      action:'calculator_run',
      active:true,
      sideEffect:'compute'
    };

    expect(compileCapabilityExposure(capability, {
      model:'ollama-tool',
      modelRegistry,
      passportRegistry,
      health:{ status:'degraded' }
    })).toMatchObject({
      exposed:true,
      health:'degraded'
    });

    expect(compileCapabilityExposure(capability, {
      model:'ollama-tool',
      modelRegistry,
      passportRegistry,
      health:{ status:'unavailable' }
    })).toMatchObject({
      exposed:false,
      code:'CAPABILITY_UNAVAILABLE'
    });
  });

  test('discovery filters model capabilities using passport without changing no-model behavior', () => {
    const { modelRegistry, passportRegistry } = registries();

    const unrestricted = discoverCapabilities({
      query:'calculator accounting',
      limit:50
    });
    expect(unrestricted.capabilities.length).toBeGreaterThan(0);

    const restricted = discoverCapabilities({
      query:'calculator accounting',
      model:'ollama-tool',
      modelRegistry,
      passportRegistry,
      limit:50
    });

    const actions = restricted.capabilities.map(item => item.action);
    expect(actions.every(action =>
      ['calculator_run', 'accounting_journal_post'].includes(action)
    )).toBe(true);
    expect(restricted.capabilities.every(item =>
      item.exposure?.model_id === 'ollama-tool'
    )).toBe(true);
  });

  test('discovery fails closed when a model has no capability passport', () => {
    const modelRegistry = new ModelRegistry([
      {
        model_id:'unqualified-model',
        provider_id:'OLLAMA',
        supports_json:true,
        enabled:true
      }
    ]);

    const result = discoverCapabilities({
      query:'financial analysis',
      model:'unqualified-model',
      modelRegistry,
      passportRegistry:new ModelCapabilityPassportRegistry(),
      limit:20
    });

    expect(result.returned).toBe(0);
    expect(result.capabilities).toEqual([]);
  });
});
