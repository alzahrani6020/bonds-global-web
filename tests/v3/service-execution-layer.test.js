const { capabilityServiceCode } = require('../../lib/services/service-execution-router');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Unified service execution layer', () => {
  test('services API exposes governed execution endpoint', () => {
    const api = read('v3/api/services.js');
    expect(api).toContain("path === '/services/execute'");
    expect(api).toContain('executeService({');
    expect(api).toContain('service_code is required');
    expect(api).toContain("/services\\/([^/]+)\\/execution");
  });

  test('capability service resolution follows the central capability registry', () => {
    expect(capabilityServiceCode('orchestrator_run')).toBe('orchestrator');
    expect(capabilityServiceCode('calculator_open')).toBe('assistant');
    expect(capabilityServiceCode('calculator_run')).toBe('assistant');
    expect(capabilityServiceCode('risk_analysis_run')).toBe('financial-engine');
    expect(capabilityServiceCode('scenario_forecast_run')).toBe('financial-engine');
    expect(capabilityServiceCode('unknown_capability')).toBeNull();
  });

  test('router resolves service profile before execution', () => {
    const router = read('lib/services/service-execution-router.js');
    expect(router).toContain("from('service_execution_profiles')");
    expect(router).toContain("from('service_capability_map')");
    expect(router).toContain("SERVICE_EXECUTION_NOT_AUTOMATED");
    expect(router).toContain('getCapability');
    expect(router).toContain('capability?.serviceCode');
    expect(router).toContain("orchestrator_run");
    expect(router).toContain("calculator_open");
    expect(router).toContain("calculator_run");
    expect(router).toContain("SERVICE_CALCULATOR_NOT_REGISTERED");
    expect(router).toContain('issueBrokerServiceToken');
    expect(router).toContain('revokeBrokerServiceToken');
    expect(router).toContain('executeCapability');
  });

  test('registered calculators are resolved centrally', () => {
    const registry = read('lib/services/service-tool-registry.js');
    expect(registry).toContain("require('../../data/tools-registry.json')");
    expect(registry).toContain('ASSISTANT_CALCULATOR_BY_TOOL');
    expect(registry).toContain("'break-even': 'break_even'");
    expect(registry).toContain("'cash-flow': 'cash_flow'");
    expect(registry).toContain("creditworthiness: 'creditworthiness'");
    expect(registry).toContain('toolById');
  });

  test('creditworthiness is registered as a governed assistant calculator destination', () => {
    const calculators = read('lib/assistant/calculator-registry.json');
    const navigation = read('lib/assistant/navigation-registry.json');
    expect(calculators).toContain('"creditworthiness"');
    expect(calculators).toContain('"calculator_creditworthiness"');
    expect(navigation).toContain('"calculator_creditworthiness"');
    expect(navigation).toContain('/calculators/creditworthiness');
  });

  test('assistant delegates service execution to the same router', () => {
    const assistant = read('v3/api/assistant.js');
    expect(assistant).toContain("path === '/assistant/services/execute'");
    expect(assistant).toContain("source:body.source || 'assistant'");
    expect(assistant).toContain('executeService({');
  });

  test('service execution endpoints use compute rate-limit class', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain("path === '/services/execute'");
    expect(api).toContain("/^\\/services\\/[^/]+\\/execution$/.test(path)");
  });
});
