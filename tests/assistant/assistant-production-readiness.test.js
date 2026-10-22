/**
 * @jest-environment node
 */
'use strict';

const mockGetSupabase = jest.fn();
jest.mock('../../lib/api/supabase', () => mockGetSupabase);

const { probeAssistantReadiness } = require('../../lib/assistant/production-readiness');
const originalEnv = { ...process.env };

function healthyData() {
  return {
    schema_version: 1,
    ready: true,
    checks: {
      audit_table: true,
      audit_rls: true,
      audit_events: true,
      audit_append_service_only: true,
      audit_no_direct_access: true,
      audit_immutable: true,
      idempotency_table: true,
      idempotency_rls: true,
      idempotency_service_only: true
    }
  };
}

function database(data = healthyData(), error = null) {
  return { rpc: jest.fn().mockResolvedValue({ data, error }) };
}

describe('Assistant production database readiness', () => {
  beforeEach(() => {
    mockGetSupabase.mockReset();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-readiness-test-key';
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('requires the versioned RPC and every database invariant before returning ok', async () => {
    const supabase = database({ ...healthyData(), unexpected_secret: 'do-not-return' });
    mockGetSupabase.mockReturnValue(supabase);

    const result = await probeAssistantReadiness();

    expect(result).toEqual({ status: 'ok', code: null, schema_version: 1 });
    expect(mockGetSupabase).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('assistant_rollout_readiness');
    expect(JSON.stringify(result)).not.toContain('do-not-return');
  });

  test.each(Object.keys(healthyData().checks))('does not trust ready=true when %s is false', async key => {
    const data = healthyData();
    data.checks[key] = false;

    expect(await probeAssistantReadiness({ supabase: database(data) })).toEqual({
      status: 'not_ready', code: 'ASSISTANT_DATABASE_NOT_READY'
    });
  });

  test.each(Object.keys(healthyData().checks))('rejects a missing %s assertion', async key => {
    const data = healthyData();
    delete data.checks[key];

    expect(await probeAssistantReadiness({ supabase: database(data) })).toEqual({
      status: 'invalid_contract', code: 'ASSISTANT_READINESS_CONTRACT_INVALID'
    });
  });

  test.each([
    null,
    [],
    { status: 'ok' },
    { ...healthyData(), schema_version: '1' },
    { ...healthyData(), schema_version: 2 },
    { ...healthyData(), ready: 'true' },
    { ...healthyData(), checks: [] },
    { ...healthyData(), checks: { ...healthyData().checks, audit_immutable: 'true' } }
  ])('rejects malformed or incompatible RPC data: %j', async data => {
    expect(await probeAssistantReadiness({ supabase: database(data) })).toEqual({
      status: 'invalid_contract', code: 'ASSISTANT_READINESS_CONTRACT_INVALID'
    });
  });

  test('respects a negative database readiness result even with true checks', async () => {
    expect(await probeAssistantReadiness({
      supabase: database({ ...healthyData(), ready: false })
    })).toEqual({ status: 'not_ready', code: 'ASSISTANT_DATABASE_NOT_READY' });
  });

  test('a missing function or permission error does not disclose database details', async () => {
    const result = await probeAssistantReadiness({
      supabase: database(null, { code: '42501', message: 'secret database details' })
    });

    expect(result).toEqual({ status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('transport exceptions are bounded and fail readiness', async () => {
    const supabase = { rpc: jest.fn().mockRejectedValue(new Error('sensitive endpoint details')) };
    expect(await probeAssistantReadiness({ supabase })).toEqual({
      status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE'
    });
  });

  test.each(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])(
    'does not fall back to an anonymous client when %s is missing', async key => {
      delete process.env[key];
      process.env.SUPABASE_ANON_KEY = 'anonymous-test-key';

      expect(await probeAssistantReadiness()).toEqual({
        status: 'not_configured', code: 'ASSISTANT_DATABASE_UNCONFIGURED'
      });
      expect(mockGetSupabase).not.toHaveBeenCalled();
    }
  );
});
