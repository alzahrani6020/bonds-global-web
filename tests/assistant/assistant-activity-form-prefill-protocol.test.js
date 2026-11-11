/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const {
  ACTIVITY_PREFILL_FIELD_IDS,
  planRegisteredAction
} = require('../../lib/assistant/protocol');

describe('activity form_prefill protocol', () => {
  test('exposes only the four approved activity field ids', () => {
    expect([...ACTIVITY_PREFILL_FIELD_IDS]).toEqual([
      'activityCode','licenseAuthority','licenseNumber','operatingLocations'
    ]);
  });

  test('plans activity prefill as suggested-only and strips unsupported fields', () => {
    const long = 'x'.repeat(240);
    const result = planRegisteredAction({
      type:'form_prefill',
      form:'activity',
      fields:{
        activityCode:'  5610  ',
        licenseAuthority:' Ministry ',
        licenseNumber:long,
        operatingLocations:' Riyadh ',
        selector:'#danger',
        annualRevenue:'1000000',
        employees:'12',
        fundingUse:'expansion'
      }
    });
    expect(result.status).toBe('ready');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      type:'form_prefill',
      capability:'form_prefill',
      target:'activity',
      risk:'low',
      input:{
        navigation_target:'business_activity',
        status:'suggested',
        fields:{
          activityCode:'5610',
          licenseAuthority:'Ministry',
          operatingLocations:'Riyadh'
        }
      }
    });
    expect(result.actions[0].input.fields.licenseNumber).toHaveLength(200);
    expect(result.actions[0].input.fields.selector).toBeUndefined();
    expect(result.actions[0].input.fields.annualRevenue).toBeUndefined();
    expect(result.actions[0].input.fields.employees).toBeUndefined();
    expect(result.actions[0].input.fields.fundingUse).toBeUndefined();
  });

  test('still denies unsupported forms including cash_flow', () => {
    expect(planRegisteredAction({
      type:'form_prefill',
      form:'cash_flow',
      fields:{ activityCode:'x' }
    }).context.code).toBe('FORM_PREFILL_FORM_NOT_SUPPORTED');

    expect(planRegisteredAction({
      type:'form_prefill',
      form:'activity',
      fields:{ selector:'#x', annualRevenue:'1' }
    }).context.code).toBe('PREFILL_FIELDS_EMPTY');
  });

  test('execute action allow-lists remain split exactly as before', () => {
    const aiApi = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');
    expect(aiApi).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(aiApi).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(aiApi).not.toContain("new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft', 'form_prefill'])");
    expect(aiApi).not.toContain('execution_authorized: true');
  });
});
