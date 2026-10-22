/**
 * @jest-environment node
 */

const {
  getCapability,
  getService,
  validateCapabilityInput
} = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('assistant read capabilities', () => {
  test('assistant service is enabled without performance ceilings or service-token coupling', () => {
    const service = getService('assistant');
    expect(service).toBeTruthy();
    expect(service.enabled).toBe(true);
    expect(service.security.serviceTokenRequired).toBe(false);
    expect(service.limits).toEqual({
      requestsPerMinute: null,
      retryMaxAttempts: null
    });
  });

  test.each([
    'site_navigate',
    'form_find',
    'form_load',
    'funding_status',
    'funding_next_step',
    'funding_next_requirements',
    'project_status'
  ])('%s is registered and active', action => {
    const capability = getCapability(action);
    expect(capability).toBeTruthy();
    expect(capability.active).toBe(true);
    expect(capability.serviceCode).toBe('assistant');
  });

  test('required resource identifiers are validated before execution', () => {
    expect(validateCapabilityInput('funding_status', {}).code).toBe('MISSING_INPUTS');
    expect(validateCapabilityInput('project_status', {}).code).toBe('MISSING_INPUTS');
    expect(validateCapabilityInput('site_navigate', {}).code).toBe('MISSING_INPUTS');
  });

  test('site navigation resolves only a registered logical target', async () => {
    const adapter = getRuntimeAdapter('assistant_site_navigate');
    const ok = await adapter({ target:'cash_flow', language:'ar' });
    expect(ok).toMatchObject({
      ok:true,
      executed:true,
      result:{
        target:'cash_flow',
        route:'/client/cash-flow'
      }
    });
    expect(ok.result.url).toBeUndefined();

    const denied = await adapter({ target:'https://evil.example' });
    expect(denied).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:404,
      error:{ code:'NAVIGATION_TARGET_NOT_REGISTERED' }
    });
  });

  test('form discovery and load remain registry-bound', async () => {
    const find = getRuntimeAdapter('assistant_form_find');
    const load = getRuntimeAdapter('assistant_form_load');

    const found = await find({ form:'cash_flow' });
    expect(found).toMatchObject({
      ok:true,
      result:{
        form:'cash_flow',
        navigation_target:'cash_flow',
        funding_requirement:'cash_flow',
        data_scope:'case'
      }
    });

    const loaded = await load({ form:'cash_flow', language:'en' });
    expect(loaded).toMatchObject({
      ok:true,
      result:{
        form:'cash_flow',
        navigation:{
          target:'cash_flow',
          route:'/en/client/cash-flow'
        }
      }
    });

    expect((await load({ form:'unknown' })).error.code).toBe('FORM_NOT_REGISTERED');
  });
});
