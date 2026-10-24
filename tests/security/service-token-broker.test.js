/** @jest-environment node */
'use strict';

const {
  resolveBrokerChannel,
  issueBrokerServiceToken,
  revokeBrokerServiceToken
} = require('../../lib/security/service-token-broker');

const issueUrl = 'https://token.example.test/broker/issue';
const introspectionUrl = 'https://token.example.test/introspect';
const brokerSecret = 'isolated-broker-credential-12345678901234567890';
const token = 'bonds_' + 'x'.repeat(64);

describe('server-side automatic service token broker', () => {
  test('requires a separate HTTPS broker endpoint on the introspection origin', () => {
    expect(resolveBrokerChannel({ issueUrl, introspectionUrl, brokerSecret })).toMatchObject({
      ok: true,
      issueUrl,
      revokeUrl: 'https://token.example.test/broker/revoke',
      origin: 'https://token.example.test'
    });

    for (const bad of [
      'http://token.example.test/broker/issue',
      'https://user:pass@token.example.test/broker/issue',
      'https://token.example.test/issue',
      'https://token.example.test/broker/issue?secret=x',
      'https://other.example.test/broker/issue'
    ]) {
      expect(resolveBrokerChannel({
        issueUrl: bad,
        introspectionUrl,
        brokerSecret
      })).toMatchObject({ ok: false, code: 'TOKEN_BROKER_INVALID_CONFIGURATION' });
    }
  });

  test('allows only explicit development loopback HTTP on 127.0.0.1:8771', () => {
    const previousAllow = process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP;
    const previousVercel = process.env.VERCEL_ENV;
    try {
      process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP = '1';
      delete process.env.VERCEL_ENV;

      expect(resolveBrokerChannel({
        issueUrl:'http://127.0.0.1:8771/broker/issue',
        introspectionUrl:'http://127.0.0.1:8771/introspect',
        brokerSecret
      })).toMatchObject({ ok:true, origin:'http://127.0.0.1:8771' });

      for (const bad of [
        ['http://localhost:8771/broker/issue','http://localhost:8771/introspect'],
        ['http://127.0.0.1:9999/broker/issue','http://127.0.0.1:9999/introspect'],
        ['http://192.168.1.5:8771/broker/issue','http://192.168.1.5:8771/introspect']
      ]) {
        expect(resolveBrokerChannel({ issueUrl:bad[0], introspectionUrl:bad[1], brokerSecret }))
          .toMatchObject({ ok:false, code:'TOKEN_BROKER_INVALID_CONFIGURATION' });
      }

      process.env.VERCEL_ENV = 'production';
      expect(resolveBrokerChannel({
        issueUrl:'http://127.0.0.1:8771/broker/issue',
        introspectionUrl:'http://127.0.0.1:8771/introspect',
        brokerSecret
      })).toMatchObject({ ok:false, code:'TOKEN_BROKER_INVALID_CONFIGURATION' });
    } finally {
      if (previousAllow === undefined) delete process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP;
      else process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP = previousAllow;
      if (previousVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercel;
    }
  });

  test('issues only by audience and never sends user authorization', async () => {
    const fetchImpl = jest.fn(async (_url, options) => ({
      ok: true,
      redirected: false,
      json: async () => ({
        status: 'issued',
        token,
        audience: 'research-intelligence',
        one_time: true
      })
    }));

    const result = await issueBrokerServiceToken({
      audience: 'research-intelligence',
      issueUrl,
      introspectionUrl,
      brokerSecret,
      fetchImpl
    });

    expect(result).toEqual({
      ok: true,
      token,
      audience: 'research-intelligence',
      oneTime: true
    });

    const [target, options] = fetchImpl.mock.calls[0];
    expect(target).toBe(issueUrl);
    expect(options.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'X-Bonds-Broker': brokerSecret
    });
    expect(JSON.parse(options.body)).toEqual({ audience: 'research-intelligence' });
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.redirect).toBe('error');
    expect(options.credentials).toBe('omit');
    expect(options.cache).toBe('no-store');
  });

  test('fails closed without exposing broker credentials or token material', async () => {
    for (const fetchImpl of [
      async () => ({ ok: false, status: 401, redirected: false }),
      async () => { throw new Error('transport ' + brokerSecret); },
      async () => ({ ok: true, redirected: false, json: async () => ({ token: 'bad' }) })
    ]) {
      const result = await issueBrokerServiceToken({
        audience: 'research-intelligence',
        issueUrl,
        introspectionUrl,
        brokerSecret,
        fetchImpl
      });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(brokerSecret);
      expect(JSON.stringify(result)).not.toContain(token);
    }
  });

  test('revoke uses the broker channel and returns only revocation state', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      redirected: false,
      json: async () => ({ revoked: true })
    }));
    const result = await revokeBrokerServiceToken({
      token,
      issueUrl,
      introspectionUrl,
      brokerSecret,
      fetchImpl
    });
    expect(result).toEqual({ ok: true, revoked: true });
    const [target, options] = fetchImpl.mock.calls[0];
    expect(target).toBe('https://token.example.test/broker/revoke');
    expect(JSON.parse(options.body)).toEqual({ token });
    expect(options.headers['X-Bonds-Broker']).toBe(brokerSecret);
  });
});
