/**
 * @jest-environment node
 */

const { getCapability, getService } = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');
const calculatorRegistry = require('../../lib/assistant/calculator-registry.json');

describe('assistant calculator capabilities', () => {
  test('calculator capabilities are registered without service-token or throughput coupling', () => {
    const service = getService('assistant');
    expect(service.version).toBe(5);
    expect(service.security.serviceTokenRequired).toBe(false);
    expect(service.limits).toEqual({
      requestsPerMinute: null,
      retryMaxAttempts: null
    });

    for (const action of ['calculator_open', 'calculator_run']) {
      expect(getCapability(action)).toMatchObject({
        action,
        serviceCode:'assistant',
        active:true
      });
    }
  });

  test('calculator_open resolves only registered calculator routes', async () => {
    const open = getRuntimeAdapter('assistant_calculator_open');

    expect(await open({ calculator:'loan', language:'ar' })).toMatchObject({
      ok:true,
      executed:true,
      result:{
        calculator:'loan',
        navigation:{
          target:'calculator_loan',
          route:'/calculators/loan'
        }
      }
    });

    expect(await open({ calculator:'https://evil.example' })).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:404,
      error:{ code:'CALCULATOR_NOT_REGISTERED' }
    });
  });

  test('calculator_run refuses page-only calculator profiles', async () => {
    const run = getRuntimeAdapter('assistant_calculator_run');
    expect(await run({ calculator:'loan', inputs:{} })).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:422,
      error:{ code:'CALCULATOR_NOT_RUNNABLE' }
    });
  });

  test('runnable calculator templates are registry-controlled', () => {
    expect(calculatorRegistry.calculators.company_feasibility).toMatchObject({
      runnable:true,
      engine:'ucp',
      template_code:'tmp_company_default'
    });
    expect(calculatorRegistry.calculators.factory_feasibility.template_code)
      .toBe('tmp_factory_default');
    expect(calculatorRegistry.calculators.retail_feasibility.template_code)
      .toBe('tmp_retail_default');
    expect(calculatorRegistry.calculators.restaurant_feasibility.template_code)
      .toBe('tmp_restaurant_default');
  });

  test('calculator registry never accepts a caller-supplied template as a calculator key', async () => {
    const run = getRuntimeAdapter('assistant_calculator_run');
    const result = await run({
      calculator:'tmp_company_default',
      template_code:'tmp_restaurant_default',
      inputs:{}
    });
    expect(result).toMatchObject({
      ok:false,
      error:{ code:'CALCULATOR_NOT_REGISTERED' }
    });
  });
});
