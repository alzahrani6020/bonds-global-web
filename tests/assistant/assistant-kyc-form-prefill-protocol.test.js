/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const {
  KYC_PREFILL_FIELD_IDS,
  planRegisteredAction
} = require('../../lib/assistant/protocol');

describe('KYC form_prefill protocol', () => {
  test('exposes only the twelve approved KYC field ids', () => {
    expect([...KYC_PREFILL_FIELD_IDS]).toEqual([
      'clientType','clientStatus','legalName','formerName','idNumber','unifiedNumber',
      'birthDate','nationality','registeredAddress','city','phone','email'
    ]);
  });

  test('sanitizes fields before normalizeAction and keeps them suggested-only', () => {
    const long = 'x'.repeat(240);
    const result = planRegisteredAction({
      type:'form_prefill',
      form:'kyc',
      fields:{
        legalName:'  Example Co  ',
        registeredAddress:long,
        selector:'#danger',
        declaration:'yes',
        email:'   '
      }
    });
    expect(result.status).toBe('ready');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      type:'form_prefill',
      capability:'form_prefill',
      target:'kyc',
      risk:'low',
      input:{
        navigation_target:'kyc',
        status:'suggested',
        fields:{ legalName:'Example Co' }
      }
    });
    expect(result.actions[0].input.fields.registeredAddress).toHaveLength(200);
    expect(result.actions[0].input.fields.selector).toBeUndefined();
    expect(result.actions[0].input.fields.declaration).toBeUndefined();
    expect(result.actions[0].input.fields.email).toBeUndefined();
  });

  test('denies unsupported forms and empty sanitized fields', () => {
    expect(planRegisteredAction({
      type:'form_prefill',
      form:'cash_flow',
      fields:{ legalName:'x' }
    }).context.code).toBe('FORM_PREFILL_FORM_NOT_SUPPORTED');

    expect(planRegisteredAction({
      type:'form_prefill',
      form:'kyc',
      fields:{ selector:'#x', email:'   ' }
    }).context.code).toBe('PREFILL_FIELDS_EMPTY');
  });

  test('execute allow-list remains split between baseline and entitlement-only actions', () => {
    const aiApi = fs.readFileSync(path.join(process.cwd(), 'v3/api/ai.js'), 'utf8');
    expect(aiApi).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(aiApi).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(aiApi).not.toContain("new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft', 'form_prefill'])");
    expect(aiApi).not.toContain('execution_authorized: true');
  });
});
