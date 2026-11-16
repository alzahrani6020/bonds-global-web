'use strict';

const fs = require('fs');
const path = require('path');

describe('correspondence requires privileged Supabase client', () => {
  const modulePath = '../lib/api/supabase';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key'
    };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  function loadFactory() {
    const createClient = jest.fn((url, key) => ({ url, key }));
    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    return { getSupabase: require(modulePath), createClient };
  }

  test('fails closed when service key is absent, without using anon fallback', () => {
    const { getSupabase, createClient } = loadFactory();
    expect(() => getSupabase({ requireServiceRole: true }))
      .toThrow('Supabase service role configuration missing');
    expect(createClient).not.toHaveBeenCalled();
  });

  test('rejects Vercel sensitive placeholders', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '[SENSITIVE]';
    const { getSupabase, createClient } = loadFactory();
    expect(() => getSupabase({ requireServiceRole: true }))
      .toThrow('Supabase service role configuration missing');
    expect(createClient).not.toHaveBeenCalled();
  });

  test('uses separate privileged client and preserves existing default behavior', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
    const { getSupabase, createClient } = loadFactory();
    const privileged = getSupabase({ requireServiceRole: true });
    expect(privileged.key).toBe('server-only-test-key');
    expect(getSupabase({ requireServiceRole: true })).toBe(privileged);
    const defaultClient = getSupabase();
    expect(defaultClient).not.toBe(privileged);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  test('all correspondence Supabase entry points require service role', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'api', 'correspondence.js'), 'utf8');
    expect(source).not.toMatch(/getSupabase\(\)/);
    expect((source.match(/getSupabase\(\{ requireServiceRole: true \}\)/g) || []).length).toBe(2);
  });
});
