/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  idempotencyFingerprint,
  beginIdempotentAction,
  completeIdempotentAction,
  failIdempotentAction,
  isTerminalIdempotencyRecord
} = require('../../lib/assistant/idempotency');

describe('assistant write idempotency', () => {
  const request = {
    boundary:'project:p-1',
    actionType:'form_save_draft',
    target:'kyc',
    revision:3,
    input:{ form:'kyc' }
  };

  test('fingerprint is stable for equivalent input ordering', () => {
    const a = idempotencyFingerprint({
      ...request,
      input:{ form:'kyc', nested:{ b:2, a:1 } }
    });
    const b = idempotencyFingerprint({
      ...request,
      input:{ nested:{ a:1, b:2 }, form:'kyc' }
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test('same completed write is replayed rather than executed again', () => {
    const started = beginIdempotentAction(null, request);
    expect(started.decision).toBe('execute');

    const completed = completeIdempotentAction(started.record, {
      ok:true,
      record_id:'r-1',
      status:'draft'
    });
    const retried = beginIdempotentAction(completed, request);

    expect(retried.decision).toBe('replay');
    expect(retried.record.result.record_id).toBe('r-1');
  });

  test('same in-flight write is blocked', () => {
    const started = beginIdempotentAction(null, request);
    const duplicate = beginIdempotentAction(started.record, request);
    expect(duplicate.decision).toBe('in_flight');
  });

  test('new form revision creates a new idempotency identity', () => {
    const started = beginIdempotentAction(null, request);
    const changed = beginIdempotentAction(started.record, {
      ...request,
      revision:4
    });
    expect(changed.decision).toBe('execute');
    expect(changed.key).not.toBe(started.key);
  });

  test('failed records are terminal evidence but can be retried explicitly', () => {
    const started = beginIdempotentAction(null, request);
    const failed = failIdempotentAction(started.record, { code:'NETWORK_FAILURE' });
    expect(isTerminalIdempotencyRecord(failed)).toBe(true);

    const retry = beginIdempotentAction(failed, request);
    expect(retry.decision).toBe('execute');
  });

  test('widget guards form_save_draft with a session-scoped ledger', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );

    expect(source).toContain("const ASSISTANT_IDEMPOTENCY_PREFIX = 'bonds.assistant.idempotency.v1:';");
    expect(source).toContain('idempotencyActionKey(planned.target, formRevision, boundary)');
    expect(source).toContain("existing.status === 'completed'");
    expect(source).toContain('isFreshInFlight(existing)');
    expect(source).toContain("status:'in_flight'");
    expect(source).toContain("status:'completed'");
    expect(source).toContain("status:'failed'");
    expect(source).toContain("status:'replayed'");
    expect(source).toContain("adapter.saveDraft({ idempotency_key:key })");
  });

  test('widget invalidates the write identity when form data changes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );
    expect(source).toContain("document.addEventListener('input', markFormDirty, true);");
    expect(source).toContain("document.addEventListener('change', markFormDirty, true);");
    expect(source).toContain('formRevision += 1;');
    expect(source).toContain('window.BondsAssistant.markFormDirty');
  });

  test('idempotency is not treated as authorization', () => {
    const widget = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );
    const helper = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'assistant', 'idempotency.js'),
      'utf8'
    );

    expect(widget).not.toContain('idempotency_authorized');
    expect(helper).not.toContain('authorization');
    expect(helper).not.toContain('token');
  });
});
