/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  actionFingerprint,
  prepareConfirmation,
  resolveConfirmation
} = require('../../lib/assistant/confirmation-engine');

describe('assistant confirmation engine', () => {
  const highRiskAction = {
    id:'action-900',
    type:'form_submit',
    capability:'form_submit',
    target:'kyc',
    input:{ record_id:'r-1', nested:{ b:2, a:1 } },
    risk:'high',
    requires_confirmation:true,
    status:'ready'
  };

  test('requires explicit confirmation for high-risk actions', () => {
    const confirmation = prepareConfirmation(highRiskAction, { language:'en' });
    expect(confirmation).toMatchObject({
      required:true,
      status:'pending',
      action_id:'action-900',
      risk:'high',
      execution_authorized:false
    });
    expect(confirmation.action_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  test('medium risk does not require confirmation unless the normalized action explicitly requests it', () => {
    const confirmation = prepareConfirmation({
      id:'action-200',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{},
      risk:'medium',
      requires_confirmation:false,
      status:'ready'
    });
    expect(confirmation).toMatchObject({
      required:false,
      status:'not_required',
      execution_authorized:false
    });
  });

  test('fingerprint is stable for semantically identical input key order', () => {
    const reordered = {
      ...highRiskAction,
      input:{ nested:{ a:1, b:2 }, record_id:'r-1' }
    };
    expect(actionFingerprint(reordered)).toBe(actionFingerprint(highRiskAction));
  });

  test('rejects confirmation when action payload changes', () => {
    const confirmation = prepareConfirmation(highRiskAction);
    expect(() => resolveConfirmation(
      { ...highRiskAction, input:{ record_id:'r-2' } },
      confirmation,
      'confirm'
    )).toThrow('CONFIRMATION_PAYLOAD_CHANGED');
  });

  test('records explicit user decision without granting execution authorization', () => {
    const confirmation = prepareConfirmation(highRiskAction);
    const resolved = resolveConfirmation(highRiskAction, confirmation, 'confirm');
    expect(resolved.status).toBe('confirmed');
    expect(resolved.decision).toBe('confirm');
    expect(resolved.execution_authorized).toBe(false);
    expect(resolved.resolved_at).toBeTruthy();
  });

  test('records cancellation and does not authorize execution', () => {
    const confirmation = prepareConfirmation(highRiskAction);
    const resolved = resolveConfirmation(highRiskAction, confirmation, 'cancel');
    expect(resolved.status).toBe('cancelled');
    expect(resolved.execution_authorized).toBe(false);
  });

  test('widget prepares and resolves confirmation without treating it as execution authorization', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );
    expect(source).toContain('ASSISTANT_CONFIRMATION_PREPARE_URL');
    expect(source).toContain('ASSISTANT_CONFIRMATION_RESOLVE_URL');
    expect(source).toContain('pending_confirmation: confirmationStateSummary(confirmation)');
    expect(source).toContain("status: resolved.status === 'confirmed'");
    expect(source).toContain("'confirmed_pending_governance'");
    expect(source).toContain('Sensitive execution still requires the governed execution layer.');
  });

  test('assistant API exposes prepare and resolve routes without issuing tokens', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'api', 'assistant.js'),
      'utf8'
    );
    expect(source).toContain("'/assistant/confirmation/prepare'");
    expect(source).toContain("'/assistant/confirmation/resolve'");
    expect(source).toContain('prepareConfirmation(body.action');
    expect(source).toContain('resolveConfirmation(body.action, body.confirmation, body.decision');
    expect(source).not.toContain('confirmation_token');
    expect(source).not.toContain('ConfirmationToken');
  });
});
