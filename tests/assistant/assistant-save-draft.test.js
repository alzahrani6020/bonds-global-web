/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const { planRegisteredAction } = require('../../lib/assistant/protocol');
const formRegistry = require('../../lib/assistant/form-registry.json');

describe('assistant governed save draft', () => {
  test('plans draft save only for a registered form', () => {
    const envelope = planRegisteredAction({
      type:'form_save_draft',
      form:'kyc',
      language:'en'
    });
    expect(envelope.status).toBe('ready');
    expect(envelope.actions).toHaveLength(1);
    expect(envelope.actions[0]).toMatchObject({
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      risk:'medium',
      requires_confirmation:false,
      status:'ready'
    });
  });

  test('denies an unregistered draft target', () => {
    const envelope = planRegisteredAction({
      type:'form_save_draft',
      form:'not_registered'
    });
    expect(envelope.status).toBe('denied');
    expect(envelope.context.code).toBe('FORM_NOT_REGISTERED');
    expect(envelope.actions).toHaveLength(0);
  });

  test('all registered forms declare explicit save_draft risk', () => {
    for (const [code, form] of Object.entries(formRegistry.forms)) {
      expect(code).toBeTruthy();
      expect(form.risk?.save_draft).toBe('medium');
    }
  });

  test('widget requires exact registered page adapter and verified persisted result', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );
    expect(source).toContain('window.BondsAssistantFormAdapter');
    expect(source).toContain('adapter.form_code !== planned.target');
    expect(source).toContain("result.ok !== true");
    expect(source).toContain('!result.record_id');
    expect(source).toContain("result.status !== 'draft'");
    expect(source).toContain('DRAFT_VERIFICATION_FAILED');
    expect(source).toContain('Draft saved and verified.');
  });

  test.each([
    ['client/kyc.html', "form_code:'kyc'"],
    ['en/client/kyc.html', "form_code:'kyc'"],
    ['client/establishment-information.html', "form_code:'establishment'"],
    ['en/client/establishment-information.html', "form_code:'establishment'"],
    ['client/business-activity.html', "form_code:'activity'"],
    ['en/client/business-activity.html', "form_code:'activity'"],
    ['client/cash-flow.html', "form_code:'cash_flow'"],
    ['en/client/cash-flow.html', "form_code:'cash_flow'"],
    ['client/receivables-aging.html', "form_code:'receivables'"],
    ['en/client/receivables-aging.html', "form_code:'receivables'"],
    ['client/payables-aging.html', "form_code:'payables'"],
    ['en/client/payables-aging.html', "form_code:'payables'"]
  ])('%s registers a verified draft adapter', (relativePath, formCode) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
    expect(source).toContain('window.BondsAssistantFormAdapter');
    expect(source).toContain(formCode);
    expect(source).toContain('FORM_NOT_EDITABLE');
    expect(source).toContain("saved.status==='draft'");
    expect(source).toContain('saved!==before');
  });

  test('shared credit consent adapter selects only the registered business/individual form codes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'forms', 'credit-consent-form.js'),
      'utf8'
    );
    expect(source).toContain('window.BondsAssistantFormAdapter');
    expect(source).toContain("subjectType==='business'?'credit_business':'credit_individual'");
    expect(source).toContain('FORM_NOT_EDITABLE');
    expect(source).toContain("saved.status==='draft'");
    expect(source).toContain('saved!==before');
  });
});
