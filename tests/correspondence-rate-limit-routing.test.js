'use strict';

const fs = require('fs');
const path = require('path');

// Regression contract: document reads must not exhaust the login/mutation bucket.
describe('governed correspondence rate-limit routing', () => {
  const platform = fs.readFileSync(path.join(__dirname, '..', 'api', 'platform.js'), 'utf8');
  const limiter = require('../lib/api/rate-limit');
  const correspondenceRoute = platform.match(
    /\/\/ Dynamic correspondence \/ Letterhead([\s\S]*?)\/\/ Letterhead email/
  );

  test('retains global protection and the dedicated correspondence limiter', () => {
    expect(platform).toContain("checkRateLimit('global', req, res)");
    expect(correspondenceRoute).not.toBeNull();
    expect(correspondenceRoute[1]).toContain('checkRateLimit(corrRateCategory, req, res)');
    expect(correspondenceRoute[1]).toContain('correspondence.handler(req, res)');
  });

  test('GET reads use existing admin_read bucket while mutations retain auth', () => {
    expect(limiter.LIMITS.admin_read.limit).toBe(60);
    expect(limiter.LIMITS.auth.limit).toBe(10);
    expect(correspondenceRoute[1]).toMatch(/req\.method\s*===\s*'GET'\s*\?\s*'admin_read'\s*:\s*'auth'/);
  });

  test('public verification continues to use public bucket', () => {
    expect(correspondenceRoute[1]).toMatch(/corrAction\s*===\s*'verify'\s*\|\|\s*corrAction\s*===\s*'qr'/);
    expect(correspondenceRoute[1]).toMatch(/\?\s*'public'/);
  });
});
