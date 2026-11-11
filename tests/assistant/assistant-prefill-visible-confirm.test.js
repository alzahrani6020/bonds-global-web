/** @jest-environment node */

const fs = require('fs');
const path = require('path');

describe('visible widget confirmation before form_prefill apply', () => {
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const ai = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');

  test('keeps form_prefill out of the sensitive confirmation engine so apply still runs after visible confirm', () => {
    const start=widget.indexOf('function renderPrefillConfirmCard');
    const end=widget.indexOf('async function executeStructuredAction',start);
    const card=widget.slice(start,end);
    expect(start).toBeGreaterThan(-1);
    expect(card).toContain("dataset.prefillConfirm = '1'");
    expect(card).toContain('item.textContent');
    expect(card).toContain("languageCode() === 'en' ? 'Fill suggested fields' : 'ملء الحقول المقترحة'");
    expect(card).toContain('{ prefillConfirmed: true }');
    expect(card).not.toContain('requestConfirmation');
    expect(card).not.toContain('saveDraft(');
    expect(card).not.toContain('item.innerHTML');
    expect(card).not.toContain('form_submit');
    expect(card).not.toContain('execution_authorized: true');
  });

  test('execute block plans first, shows visible confirm, then applies only after confirm', () => {
    const start=widget.indexOf("if (action.type === 'form_prefill') {");
    const end=widget.indexOf("if (action.type === 'form_find' || action.type === 'form_load')",start);
    const source=widget.slice(start,end);
    expect(source.indexOf('requestGovernedPlan(action)')).toBeGreaterThan(-1);
    expect(source.indexOf('renderPrefillConfirmCard(action, planned, button)')).toBeGreaterThan(
      source.indexOf('requestGovernedPlan(action)')
    );
    expect(source.indexOf('const result = adapter.applyPrefill')).toBeGreaterThan(
      source.indexOf('options.prefillConfirmed === true')
    );
    expect(source).not.toContain('saveDraft(');
    expect(source).not.toContain('submit');
    expect(source).not.toContain('requestConfirmation');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('navigation_target');
  });

  test('does not raise form_prefill into high-risk confirmation or the baseline four-set', () => {
    expect(ai).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(ai).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(ai).toContain('The widget must show a visible confirmation of the planned suggested fields before applying them.');
    expect(ai).not.toContain("form_save_draft', 'form_prefill");
    expect(ai).not.toContain('execution_authorized: true');
    expect(widget).toContain("if (action.requires_confirmation)");
    expect(widget).toContain("'confirmed_pending_governance'");
  });
});
