const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function getGlobalHeaders() {
  const config = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')
  );

  const globalRule = config.headers.find(
    rule => rule.source === '/(.*)'
  );

  if (!globalRule) {
    throw new Error('Global header rule not found');
  }

  return globalRule.headers;
}

describe('CSP security baseline', () => {
  test('enforces a minimal CSP baseline', () => {
    const headers = getGlobalHeaders();

    const csp = headers.find(
      header => header.key === 'Content-Security-Policy'
    );

    expect(csp).toBeDefined();
    expect(csp.value).toContain("object-src 'none'");
    expect(csp.value).toContain("base-uri 'self'");
    expect(csp.value).toContain("frame-ancestors 'self'");
    expect(csp.value).toContain('upgrade-insecure-requests');
  });

  test('baseline CSP does not prematurely restrict scripts or styles', () => {
    const headers = getGlobalHeaders();

    const csp = headers.find(
      header => header.key === 'Content-Security-Policy'
    );

    expect(csp.value).not.toContain('script-src');
    expect(csp.value).not.toContain('style-src');
    expect(csp.value).not.toContain('default-src');
  });

  test('keeps the broader CSP in report-only mode for migration', () => {
    const headers = getGlobalHeaders();

    const reportOnly = headers.find(
      header => header.key === 'Content-Security-Policy-Report-Only'
    );

    expect(reportOnly).toBeDefined();
    expect(reportOnly.value).toContain("default-src 'self'");
    expect(reportOnly.value).toContain('script-src');
    expect(reportOnly.value).toContain('style-src');
    expect(reportOnly.value).not.toContain("'unsafe-eval'");
  });
});
