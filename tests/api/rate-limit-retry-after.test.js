/** @jest-environment node */
'use strict';

jest.mock('../../lib/api/rate-limit-distributed', () => ({
  checkRateLimitDistributed: jest.fn(async () => null)
}));

const { checkRateLimit, LIMITS } = require('../../lib/api/rate-limit');

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('local AI limiter preserves the limit and retries only after the current window', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-11-20T12:00:50.000Z'));
    const req = { method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const identity = 'e2e-local-retry-window-' + Math.random();
    for (let i = 0; i < LIMITS.ai.limit; i++) {
      const res = response();
      expect(await checkRateLimit('ai', req, res, identity)).toBe(false);
      expect(res.statusCode).toBe(200);
    }
    const denied = response();
    expect(await checkRateLimit('ai', req, denied, identity)).toBe(true);
    expect(denied.statusCode).toBe(429);
    expect(denied.headers['Retry-After']).toBe('10');
    expect(denied.headers['X-RateLimit-Remaining']).toBe('0');

    jest.advanceTimersByTime(10_000);
    const nextWindow = response();
    expect(await checkRateLimit('ai', req, nextWindow, identity)).toBe(false);
    expect(nextWindow.statusCode).toBe(200);
  } finally {
    jest.useRealTimers();
  }
});
