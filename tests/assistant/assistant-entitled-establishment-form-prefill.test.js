/** @jest-environment node */

const fs = require('fs');
const path = require('path');

describe('entitled establishment form_prefill execute-mode contracts', () => {
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const ar = fs.readFileSync(path.join(process.cwd(),'client/establishment-information.html'),'utf8');
  const en = fs.readFileSync(path.join(process.cwd(),'en/client/establishment-information.html'),'utf8');

  test('widget supports governed establishment prefill without persistence or submit', () => {
    expect(widget).toContain("['form_find', 'form_load', 'form_save_draft', 'form_prefill'].includes(action.type)");
    expect(widget).toContain("action.type === 'form_prefill' ? { fields: action.input && action.input.fields } : {}");
    expect(widget).toContain("!['kyc','establishment'].includes(String(planned.target))");
    expect(widget).toContain("adapter.form_code !== planned.target");
    expect(widget).toContain("target:planned.target");
    expect(widget).toContain("Fill establishment fields");
    expect(widget).toContain("ملء حقول المنشأة");
    expect(widget).toContain("Suggested fields were filled. Review them, then save the draft.");
    const start=widget.indexOf("if (action.type === 'form_prefill') {");
    const end=widget.indexOf("if (action.type === 'form_find' || action.type === 'form_load')",start);
    const source=widget.slice(start,end);
    expect(source).not.toContain('saveDraft(');
    expect(source).not.toContain('submit');
  });

  test.each([['client/establishment-information.html',ar],['en/client/establishment-information.html',en]])('%s prefill adapter stays field-id only and non-persisting', (_name, source) => {
    expect(source).toContain("const allowed=['legalName','city','phone','email'];");
    expect(source).toContain('document.getElementById(id)');
    expect(source).toContain("code:'FORM_NOT_EDITABLE'");
    const start=source.indexOf('applyPrefill(fields){');
    const end=source.indexOf('async saveDraft(){',start);
    const prefill=source.slice(start,end);
    expect(prefill).not.toContain('querySelector');
    expect(prefill).not.toContain('innerHTML');
    expect(prefill).not.toContain('save(');
    expect(prefill).not.toContain('submit');
    expect(prefill).not.toContain('capital');
    expect(prefill).not.toContain('vat');
    expect(prefill).not.toContain('employees');
    expect(prefill).not.toContain('authorizedEmail');
    expect(prefill).not.toContain('files');
  });
});
