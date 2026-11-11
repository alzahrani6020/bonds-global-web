/** @jest-environment node */

const fs = require('fs');
const path = require('path');

describe('entitled KYC form_prefill execute-mode contracts', () => {
  const ai = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const arKyc = fs.readFileSync(path.join(process.cwd(),'client/kyc.html'),'utf8');
  const enKyc = fs.readFileSync(path.join(process.cwd(),'en/client/kyc.html'),'utf8');

  test('keeps baseline execute actions unchanged and gates prefill separately', () => {
    expect(ai).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(ai).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(ai).toContain('executeEntitled === true && EXECUTE_ENTITLED_ACTION_TYPES.has(type)');
    expect(ai).not.toContain("form_save_draft', 'form_prefill");
    expect(ai).not.toContain('execution_authorized: true');
  });

  test('widget forwards suggested fields only for form_prefill and never saves or submits them', () => {
    expect(widget).toContain("['form_find', 'form_load', 'form_save_draft', 'form_prefill'].includes(action.type)");
    expect(widget).toContain("action.type === 'form_prefill' ? { fields: action.input && action.input.fields } : {}");
    expect(widget).toContain("typeof adapter.applyPrefill !== 'function'");
    expect(widget).toContain("const result = adapter.applyPrefill(planned.input && planned.input.fields);");
    expect(widget).toContain('Suggested fields were filled. Review them, then save the draft.');
    const start=widget.indexOf("if (action.type === 'form_prefill') {");
    const end=widget.indexOf("if (action.type === 'form_find' || action.type === 'form_load')",start);
    const source=widget.slice(start,end);
    expect(source).toContain('options.prefillConfirmed === true');
    expect(source).toContain('renderPrefillConfirmCard(action, planned, button)');
    expect(source).not.toContain('saveDraft(');
    expect(source).not.toContain('submit');
    expect(source).not.toContain('requestConfirmation');
  });

  test.each([['client/kyc.html',arKyc],['en/client/kyc.html',enKyc]])('%s prefill adapter is field-id only and non-persisting', (_name, source) => {
    expect(source).toContain("const allowed=['clientType','clientStatus','legalName','formerName','idNumber','unifiedNumber','birthDate','nationality','registeredAddress','city','phone','email'];");
    expect(source).toContain('document.getElementById(id)');
    expect(source).toContain("code:'FORM_NOT_EDITABLE'");
    const start=source.indexOf('applyPrefill(fields){');
    const end=source.indexOf('async saveDraft(){',start);
    const prefill=source.slice(start,end);
    expect(prefill).not.toContain('querySelector');
    expect(prefill).not.toContain('innerHTML');
    expect(prefill).not.toContain('declaration');
    expect(prefill).not.toContain('verificationConsent');
    expect(prefill).not.toContain('ubo');
    expect(prefill).not.toContain('save(');
  });
});
