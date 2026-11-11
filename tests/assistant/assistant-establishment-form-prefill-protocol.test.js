/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const {
  ESTABLISHMENT_PREFILL_FIELD_IDS,
  planRegisteredAction
} = require('../../lib/assistant/protocol');

describe('Establishment form_prefill protocol', () => {
  test('exposes only the four approved establishment field ids', () => {
    expect([...ESTABLISHMENT_PREFILL_FIELD_IDS]).toEqual([
      'legalName','city','phone','email'
    ]);
  });

  test('plans establishment prefill as suggested-only and strips unsupported fields', () => {
    const result = planRegisteredAction({
      type:'form_prefill',
      form:'establishment',
      fields:{
        legalName:'  Example Establishment  ',
        city:' Riyadh ',
        phone:' 0500000000 ',
        email:' test@example.com ',
        selector:'#danger',
        capital:'1000000'
      }
    });
    expect(result.status).toBe('ready');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      type:'form_prefill',
      capability:'form_prefill',
      target:'establishment',
      risk:'low',
      input:{
        navigation_target:'establishment_information',
        status:'suggested',
        fields:{
          legalName:'Example Establishment',
          city:'Riyadh',
          phone:'0500000000',
          email:'test@example.com'
        }
      }
    });
    expect(result.actions[0].input.fields.selector).toBeUndefined();
    expect(result.actions[0].input.fields.capital).toBeUndefined();
  });

  test('cash_flow remains unsupported for form_prefill', () => {
    expect(planRegisteredAction({
      type:'form_prefill',
      form:'cash_flow',
      fields:{ legalName:'x' }
    }).context.code).toBe('FORM_PREFILL_FORM_NOT_SUPPORTED');
  });

  test('execute action allow-lists remain split exactly as before', () => {
    const aiApi = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');
    expect(aiApi).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(aiApi).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(aiApi).not.toContain("new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft', 'form_prefill'])");
    expect(aiApi).not.toContain('execution_authorized: true');
  });
});
