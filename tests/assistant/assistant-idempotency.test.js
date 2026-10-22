/**
 * @jest-environment node
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeIdempotencyKey,
  sanitizeResult,
  normalizeClaimState
} = require('../../lib/assistant/idempotency');

describe('assistant persistent write idempotency', () => {
  test('accepts only a 64-char lowercase hex idempotency key', () => {
    const key = 'a'.repeat(64);
    expect(normalizeIdempotencyKey(key.toUpperCase())).toBe(key);
    expect(() => normalizeIdempotencyKey('short')).toThrow('INVALID_IDEMPOTENCY_KEY');
  });

  test('sanitizes stored write results to verification fields only', () => {
    expect(sanitizeResult({
      ok:true,
      code:'DRAFT_SAVED',
      record_id:'r-1',
      status:'draft',
      secret:'must-not-persist'
    })).toEqual({
      ok:true,
      code:'DRAFT_SAVED',
      record_id:'r-1',
      status:'draft'
    });
  });

  test('normalizes supported persistent claim states', () => {
    expect(normalizeClaimState({
      state:'replay_succeeded',
      status:'succeeded',
      result:{ ok:true, record_id:'r-1', status:'draft' }
    })).toMatchObject({
      state:'replay_succeeded',
      result:{ ok:true, record_id:'r-1', status:'draft' }
    });
    expect(() => normalizeClaimState({ state:'unknown' }))
      .toThrow('IDEMPOTENCY_LEDGER_RESPONSE_INVALID');
  });

  test('migration creates a server-only durable ledger and atomic claim/resolve RPCs', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261022135500_assistant_action_idempotency.sql'),
      'utf8'
    );
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.assistant_action_idempotency');
    expect(source).toContain('UNIQUE (user_id, idempotency_key)');
    expect(source).toContain("CHECK (status IN ('started','succeeded','uncertain'))");
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.assistant_claim_idempotency');
    expect(source).toContain('ON CONFLICT (user_id, idempotency_key) DO NOTHING');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.assistant_resolve_idempotency');
    expect(source).toContain('REVOKE ALL ON public.assistant_action_idempotency FROM anon, authenticated');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.assistant_claim_idempotency');
  });

  test('assistant API exposes authenticated claim and resolve endpoints', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'api', 'assistant.js'),
      'utf8'
    );
    expect(source).toContain("path === '/assistant/idempotency/claim'");
    expect(source).toContain("path === '/assistant/idempotency/resolve'");
    expect(source).toContain('claimAssistantAction');
    expect(source).toContain('resolveAssistantAction');
    expect(source).toContain('user.id');
  });

  test('widget uses payload hashing plus server claim before draft write', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
      'utf8'
    );
    expect(source).toContain('ASSISTANT_IDEMPOTENCY_CLAIM_URL');
    expect(source).toContain('ASSISTANT_IDEMPOTENCY_RESOLVE_URL');
    expect(source).toContain('crypto.subtle.digest');
    expect(source).toContain('new FormData(form)');
    expect(source).toContain('requestIdempotencyClaim(planned, idempotencyKey)');
    expect(source).toContain("claim.state === 'replay_succeeded'");
    expect(source).toContain('adapter.saveDraft({ idempotency_key:idempotencyKey })');
    expect(source).toMatch(/requestIdempotencyResolve\(\s*planned,\s*idempotencyKey,\s*'succeeded',\s*result\s*\)/s);
    expect(source).toMatch(/requestIdempotencyResolve\(\s*planned,\s*idempotencyKey,\s*'uncertain',\s*null\s*\)/s);
    expect(source).not.toContain('ASSISTANT_IDEMPOTENCY_PREFIX');
    expect(source).not.toContain("status:'failed'");
  });
});
