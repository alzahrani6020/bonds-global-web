/**
 * @jest-environment node
 */

const {
  normalizeAction,
  hasForbiddenField,
  planRegisteredAction
} = require('../../lib/assistant/protocol');
const {
  prepareConfirmation,
  resolveConfirmation
} = require('../../lib/assistant/confirmation-engine');
const {
  normalizeIdempotencyKey,
  sanitizeResult,
  normalizeClaimState
} = require('../../lib/assistant/idempotency');
const {
  sanitizeMetadata,
  hashOpaque,
  normalizeAssistantAuditEvent
} = require('../../lib/assistant/audit-trail');

describe('BONDS Assistant V1 security red-team', () => {
  test.each([
    [{ url:'https://evil.example' }, 'url'],
    [{ href:'javascript:alert(1)' }, 'href'],
    [{ javascript:'alert(1)' }, 'javascript'],
    [{ script:'fetch("/secrets")' }, 'script'],
    [{ selector:'#admin-panel' }, 'selector'],
    [{ sql:'delete from users' }, 'sql'],
    [{ raw_sql:'drop table projects' }, 'raw_sql'],
    [{ code:'process.exit()' }, 'code'],
    [{ input:{ nested:{ url:'https://evil.example' } } }, 'nested url'],
    [{ input:[{ selector:'body' }] }, 'nested selector']
  ])('blocks arbitrary execution field attack: %s (%s)', (payload) => {
    expect(hasForbiddenField(payload)).toBe(true);
    expect(() => normalizeAction({
      type:'site_navigate',
      capability:'site_navigate',
      target:'home',
      risk:'low',
      ...payload
    })).toThrow('FORBIDDEN_EXECUTION_FIELD');
  });

  test('planner refuses a model-invented external URL instead of navigating to it', () => {
    const result = planRegisteredAction({
      type:'site_navigate',
      target:'https://evil.example/phish'
    });
    expect(result.status).toBe('denied');
    expect(result.context.code).toBe('NAVIGATION_TARGET_NOT_REGISTERED');
    expect(result.actions).toHaveLength(0);
  });

  test('planner refuses unregistered form identifiers', () => {
    const result = planRegisteredAction({
      type:'form_save_draft',
      form:'../../admin/users'
    });
    expect(result.status).toBe('denied');
    expect(result.context.code).toBe('FORM_NOT_REGISTERED');
    expect(result.actions).toHaveLength(0);
  });

  test('high-risk actions require confirmation even if caller tries to disable it', () => {
    const action = normalizeAction({
      id:'redteam-high-risk',
      type:'external_send',
      capability:'external_send',
      target:'registered-target',
      risk:'high',
      requires_confirmation:false
    });
    expect(action.requires_confirmation).toBe(true);

    const confirmation = prepareConfirmation(action);
    expect(confirmation.required).toBe(true);
    expect(confirmation.execution_authorized).toBe(false);
  });

  test('confirmation tampering fails closed when target changes', () => {
    const action = {
      id:'redteam-confirm-target',
      type:'external_send',
      capability:'external_send',
      target:'recipient-a',
      input:{ message_id:'m1' },
      risk:'high',
      requires_confirmation:true
    };
    const confirmation = prepareConfirmation(action);

    expect(() => resolveConfirmation(
      { ...action, target:'recipient-b' },
      confirmation,
      'confirm'
    )).toThrow('CONFIRMATION_PAYLOAD_CHANGED');
  });

  test('confirmation tampering fails closed when input changes', () => {
    const action = {
      id:'redteam-confirm-input',
      type:'external_send',
      capability:'external_send',
      target:'recipient-a',
      input:{ amount:100 },
      risk:'high',
      requires_confirmation:true
    };
    const confirmation = prepareConfirmation(action);

    expect(() => resolveConfirmation(
      { ...action, input:{ amount:1000000 } },
      confirmation,
      'confirm'
    )).toThrow('CONFIRMATION_PAYLOAD_CHANGED');
  });

  test('confirmation cannot be reused for a different action id', () => {
    const action = {
      id:'redteam-confirm-a',
      type:'external_send',
      capability:'external_send',
      target:'recipient-a',
      risk:'high',
      requires_confirmation:true
    };
    const confirmation = prepareConfirmation(action);

    expect(() => resolveConfirmation(
      { ...action, id:'redteam-confirm-b' },
      confirmation,
      'confirm'
    )).toThrow('CONFIRMATION_ACTION_MISMATCH');
  });

  test.each([
    '',
    'abc',
    'g'.repeat(64),
    'a'.repeat(63),
    'a'.repeat(65),
    '../'.repeat(22)
  ])('rejects malformed idempotency keys: %s', (key) => {
    expect(() => normalizeIdempotencyKey(key)).toThrow('INVALID_IDEMPOTENCY_KEY');
  });

  test('idempotency ledger refuses unknown claim states', () => {
    expect(() => normalizeClaimState({
      state:'force_execute',
      status:'succeeded'
    })).toThrow('IDEMPOTENCY_LEDGER_RESPONSE_INVALID');
  });

  test('persisted write result is reduced to bounded verification fields', () => {
    const sanitized = sanitizeResult({
      ok:true,
      code:'X'.repeat(200),
      record_id:'R'.repeat(200),
      status:'draft'.repeat(30),
      secret:'must-not-survive',
      raw_payload:{ admin:true }
    });

    expect(sanitized).toEqual({
      ok:true,
      code:'X'.repeat(100),
      record_id:'R'.repeat(100),
      status:'draft'.repeat(10),
    });
    expect(sanitized.secret).toBeUndefined();
    expect(sanitized.raw_payload).toBeUndefined();
  });

  test('audit metadata drops nested secret-like payloads and invalid keys', () => {
    const cleaned = sanitizeMetadata({
      safe:'ok',
      number:7,
      bool:true,
      nested:{ service_token:'secret-token' },
      array:['secret'],
      'bad key':'secret',
      long:'x'.repeat(700)
    });

    expect(cleaned.safe).toBe('ok');
    expect(cleaned.number).toBe(7);
    expect(cleaned.bool).toBe(true);
    expect(cleaned.nested).toBeUndefined();
    expect(cleaned.array).toBeUndefined();
    expect(cleaned['bad key']).toBeUndefined();
    expect(cleaned.long).toHaveLength(500);
  });

  test('audit stores only a hash of an idempotency key, never the raw key', () => {
    const raw = 'c'.repeat(64);
    const event = normalizeAssistantAuditEvent({
      userId:'user-redteam',
      action:{
        id:'action-redteam',
        type:'form_save_draft',
        target:'kyc',
        risk:'medium'
      },
      eventType:'idempotency_claimed',
      idempotencyKey:raw,
      metadata:{ safe:'ok' }
    });

    expect(event.p_idempotency_key_hash).toBe(hashOpaque(raw));
    expect(event.p_idempotency_key_hash).not.toBe(raw);
    expect(JSON.stringify(event)).not.toContain(raw);
  });

  test('audit event type cannot be attacker-controlled', () => {
    expect(() => normalizeAssistantAuditEvent({
      userId:'user-redteam',
      action:{ type:'form_save_draft' },
      eventType:'grant_admin'
    })).toThrow('AUDIT_EVENT_INVALID');
  });

  test('authorization contract contains no AI compute or provider ceilings', () => {
    const contract = require('../../lib/assistant/assistant-protocol.contract.json');
    const serialized = JSON.stringify(contract).toLowerCase();

    expect(serialized).not.toContain('"model"');
    expect(serialized).not.toContain('"provider"');
    expect(serialized).not.toContain('"throughput"');
    expect(serialized).not.toContain('"context_size"');
    expect(serialized).not.toContain('"compute"');
  });
});
