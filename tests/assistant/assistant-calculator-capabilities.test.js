/**
 * @jest-environment node
 */

const { getCapability, getService } = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');
const calculatorRegistry = require('../../lib/assistant/calculator-registry.json');
const {
  parseLoanRequest,
  computeLoanInstallment,
  buildLoanAnswer
} = require('../../lib/assistant/deterministic-tools');

describe('assistant calculator capabilities', () => {
  test('calculator capabilities are registered without service-token or throughput coupling', () => {
    const service = getService('assistant');
    expect(service.version).toBe(5);
    expect(service.security.serviceTokenRequired).toBe(false);
    expect(service.limits).toEqual({
      requestsPerMinute: null,
      retryMaxAttempts: null
    });

    for (const action of ['calculator_open', 'calculator_run', 'math_calculate']) {
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

  test('math_calculate evaluates bounded arithmetic and rejects variables', async () => {
    const calculate = getRuntimeAdapter('assistant_math_calculate');

    expect(await calculate({ expression:'(1000000) * (18 / 100)' })).toMatchObject({
      ok:true,
      executed:true,
      result:{ value:180000 }
    });

    expect(await calculate({ expression:'revenue * 0.18' })).toMatchObject({
      ok:false,
      executed:false,
      error:{ code:'MATH_EXPRESSION_VARIABLES_NOT_ALLOWED' }
    });
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

  test('quick loan request parser extracts amount, term and rate', () => {
    expect(parseLoanRequest('احسب قسط تمويل 100,000 ريال على 5 سنوات بفائدة 8%'))
      .toEqual({ amount:100000, years:5, ratePct:8 });
    expect(parseLoanRequest('احسب قسط قرض ٥٠٠ ألف على ٣ سنوات بفائدة ٥٪؟'))
      .toEqual({ amount:500000, years:3, ratePct:5 });
    expect(parseLoanRequest('what is the monthly payment for a 200000 SAR loan over 4 years at 6.5 percent?'))
      .toEqual({ amount:200000, years:4, ratePct:6.5 });
    expect(parseLoanRequest('من هو وزير الدفاع')).toBeNull();
    expect(parseLoanRequest('احسب قسط تمويل على 5 سنوات بفائدة 8%')).toBeNull();
  });

  test('loan installment math matches the reducing-balance formula', () => {
    expect(computeLoanInstallment({ amount:100000, years:5, ratePct:8 }))
      .toMatchObject({ months:60, installment:2027.64, total:121658.37, totalInterest:21658.37 });
    expect(computeLoanInstallment({ amount:100000, years:5, ratePct:0 }))
      .toMatchObject({ months:60, installment:1666.67 });
  });

  test('loan answer carries the reply and the calculator navigation action', () => {
    const answer = buildLoanAnswer({ amount:100000, years:5, ratePct:8 }, 'ar');
    expect(answer.ok).toBe(true);
    expect(answer.reply).toContain('٢٬٠٢٨');
    expect(answer.reply).toContain('ر.س');
    expect(answer.actions).toEqual([{
      type:'site_navigate',
      capability:'site_navigate',
      target:'calculator_loan',
      risk:'low'
    }]);
    const en = buildLoanAnswer({ amount:100000, years:5, ratePct:8 }, 'en');
    expect(en.reply).toContain('SAR');
  });
});
