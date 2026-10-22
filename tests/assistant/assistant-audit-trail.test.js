/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  hashOpaque,
  normalizeAssistantAuditEvent,
  sanitizeMetadata
} = require('../../lib/assistant/audit-trail');

describe('assistant audit trail', () => {
  test('hashes idempotency keys instead of storing them directly', () => {
    const raw = 'idem-secret-value';
    const hashed = hashOpaque(raw);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain(raw);
  });

  test('normalizes bounded metadata without secrets or nested payloads', () => {
    expect(sanitizeMetadata({
      code:'OK',
      count:2,
      nested:{ secret:'x' },
      long:'x'.repeat(700)
    })).toEqual({
      code:'OK',
      count:2,
      long:'x'.repeat(500)
    });
  });

  test('builds immutable audit RPC payload for an assistant action', () => {
    const payload = normalizeAssistantAuditEvent({
      userId:'00000000-0000-0000-0000-000000000001',
      action:{
        id:'action-1',
        type:'form_save_draft',
        target:'kyc',
        risk:'medium',
        requires_confirmation:false
      },
      eventType:'write_succeeded',
      outcome:'resolved_succeeded',
      boundary:'project:p-1',
      idempotencyKey:'idem-1',
      resourceId:'record-1',
      metadata:{ requested_status:'succeeded' }
    });

    expect(payload.p_action_type).toBe('form_save_draft');
    expect(payload.p_event_type).toBe('write_succeeded');
    expect(payload.p_boundary).toBe('project:p-1');
    expect(payload.p_resource_id).toBe('record-1');
    expect(payload.p_idempotency_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.p_idempotency_key_hash).not.toBe('idem-1');
  });

  test('rejects unknown audit event names', () => {
    expect(() => normalizeAssistantAuditEvent({
      userId:'00000000-0000-0000-0000-000000000001',
      action:{ type:'site_navigate' },
      eventType:'arbitrary_event'
    })).toThrow('AUDIT_EVENT_INVALID');
  });

  test('migration is append-only for clients and exposes no direct authenticated writes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261022143000_assistant_action_audit.sql'),
      'utf8'
    );
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.assistant_action_audit');
    expect(source).toContain('REVOKE ALL ON public.assistant_action_audit FROM anon, authenticated');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.assistant_append_action_audit');
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain('SET search_path = public, pg_temp');
    expect(source).not.toMatch(/CREATE POLICY[\s\S]*FOR (INSERT|UPDATE|DELETE)/i);
  });

  test('assistant API records plan, confirmation and idempotency lifecycle events server-side', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'api', 'assistant.js'),
      'utf8'
    );
    for (const event of [
      "'planned'",
      "'denied'",
      "'confirmation_prepared'",
      "'confirmation_resolved'",
      "'idempotency_claimed'",
      "'replayed'",
      "'write_succeeded'",
      "'write_uncertain'"
    ]) {
      expect(source).toContain(event);
    }
    expect(source).toContain('appendAssistantAuditBestEffort');
  });

  test('audit trail is observability, not token, AI, or API capability gating', () => {
    const helper = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'assistant', 'audit-trail.js'),
      'utf8'
    );
    const migration = fs.readFileSync(
      path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261022143000_assistant_action_audit.sql'),
      'utf8'
    );

    expect(helper).not.toContain('model_provider');
    expect(helper).not.toContain('context_window');
    expect(helper).not.toContain('throughput_limit');
    expect(migration).toContain('not authorization, AI capability, API capability');
  });
});
