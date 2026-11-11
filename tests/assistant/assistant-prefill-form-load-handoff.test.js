/** @jest-environment node */

const fs = require('fs');
const path = require('path');

describe('form_prefill hands off to form_load when the page adapter is absent', () => {
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const ai = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');

  test('missing adapter offers governed form_load instead of a generic adapter error', () => {
    const start=widget.indexOf('function offerPrefillFormLoad');
    const end=widget.indexOf('async function executeStructuredAction',start);
    const helper=widget.slice(start,end);
    expect(start).toBeGreaterThan(-1);
    expect(helper).toContain("Open the registered form first, then confirm the suggested fields.");
    expect(helper).toContain('افتح النموذج المسجل أولاً، ثم أكّد الحقول المقترحة.');
    expect(helper).toContain("type: 'form_load'");
    expect(helper).toContain('target: planned.target');
    expect(helper).not.toContain('window.location');
    expect(helper).not.toContain('saveDraft(');
    expect(helper).not.toContain('form_submit');
    expect(helper).not.toContain('sessionStorage');
    expect(helper).not.toContain('execution_authorized: true');
  });

  test('prefill execute block calls the handoff and still never navigates or persists', () => {
    const start=widget.indexOf("if (action.type === 'form_prefill') {");
    const end=widget.indexOf("if (action.type === 'form_find' || action.type === 'form_load')",start);
    const source=widget.slice(start,end);
    expect(source).toContain('offerPrefillFormLoad(action, planned, button)');
    expect(source).not.toContain('PREFILL_ADAPTER_NOT_AVAILABLE');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('navigation_target');
    expect(source).not.toContain('saveDraft(');
    expect(source).not.toContain('submit');
    expect(source).not.toContain('requestConfirmation');
    expect(source.indexOf('offerPrefillFormLoad(action, planned, button)')).toBeLessThan(
      source.indexOf('renderPrefillConfirmCard(action, planned, button)')
    );
  });

  test('does not fold form_prefill into the baseline four-set or auto-navigate', () => {
    expect(ai).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(ai).toContain("const EXECUTE_ENTITLED_ACTION_TYPES = new Set(['form_prefill']);");
    expect(ai).toContain('If the page adapter is absent, offer form_load for the same registered form instead of applying or navigating from form_prefill.');
    expect(ai).not.toContain("form_save_draft', 'form_prefill");
    expect(ai).not.toContain('execution_authorized: true');
    expect(widget).not.toContain("throw new Error('PREFILL_ADAPTER_NOT_AVAILABLE')");
  });
});
