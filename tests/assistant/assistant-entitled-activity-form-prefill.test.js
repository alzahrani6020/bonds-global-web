/** @jest-environment node */

const fs = require('fs');
const path = require('path');

describe('entitled activity form_prefill execute-mode contracts', () => {
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const ar = fs.readFileSync(path.join(process.cwd(),'client/business-activity.html'),'utf8');
  const en = fs.readFileSync(path.join(process.cwd(),'en/client/business-activity.html'),'utf8');

  test('widget accepts kyc, establishment, or activity targets and never saves or submits prefill', () => {
    expect(widget).toContain("['form_find', 'form_load', 'form_save_draft', 'form_prefill'].includes(action.type)");
    expect(widget).toContain("action.type === 'form_prefill' ? { fields: action.input && action.input.fields } : {}");
    expect(widget).toContain("!['kyc','establishment','activity'].includes(String(planned.target))");
    expect(widget).toContain('adapter.form_code !== planned.target');
    expect(widget).toContain('options.prefillConfirmed === true');
    expect(widget).toContain('renderPrefillConfirmCard(action, planned, button)');
    expect(widget).toContain('Fill activity fields');
    expect(widget).toContain('ملء حقول النشاط');
    expect(widget).toContain('Fill establishment fields');
    expect(widget).toContain('Fill KYC fields');
    expect(widget).toContain('Suggested fields were filled. Review them, then save the draft.');
    const start=widget.indexOf("if (action.type === 'form_prefill') {");
    const end=widget.indexOf("if (action.type === 'form_find' || action.type === 'form_load')",start);
    const source=widget.slice(start,end);
    expect(source).not.toContain('saveDraft(');
    expect(source).not.toContain('submit');
    expect(source).not.toContain('requestConfirmation');
    expect(source).toContain('target:planned.target');
  });

  test.each([['client/business-activity.html',ar],['en/client/business-activity.html',en]])('%s prefill adapter is field-id only and non-persisting', (_name, source) => {
    expect(source).toContain("form_code:'activity'");
    expect(source).toContain("const allowed=['activityCode','licenseAuthority','licenseNumber','operatingLocations'];");
    expect(source).toContain('document.getElementById(id)');
    expect(source).toContain("code:'FORM_NOT_EDITABLE'");
    const start=source.indexOf('applyPrefill(fields){');
    const end=source.indexOf('async saveDraft(){',start);
    const prefill=source.slice(start,end);
    expect(prefill).not.toContain('querySelector');
    expect(prefill).not.toContain('innerHTML');
    expect(prefill).not.toContain('save(');
    expect(prefill).not.toContain('submit');
    expect(prefill).not.toContain('annualRevenue');
    expect(prefill).not.toContain('employees');
    expect(prefill).not.toContain('fundingUse');
    expect(prefill).not.toContain('primaryActivity');
    expect(prefill).not.toContain('country');
    expect(prefill).not.toContain('sector');
  });
});
