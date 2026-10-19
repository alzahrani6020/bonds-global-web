const fs = require('fs');
const path = require('path');

describe('Readiness native diagnostics contract', () => {
  const healthPath = path.join(__dirname, '..', '..', 'api', 'health.js');
  const source = fs.readFileSync(healthPath, 'utf8');

  test('exposes safe native failure classification fields', () => {
    expect(source).toContain('native_diagnostic: nativeDiagnostic');
    expect(source).toContain("code: nativeError.code || 'NATIVE_HEALTH_FAILED'");
    expect(source).toContain('http_status:');
    expect(source).toContain('executed: nativeHealth.executed === true');
    expect(source).toContain('elapsed_ms:');
  });

  test('does not expose native error detail or authorization material', () => {
    expect(source).not.toMatch(/native_diagnostic\s*:[\s\S]{0,400}\bdetail\b/i);
    expect(source).not.toMatch(/native_diagnostic\s*:[\s\S]{0,400}\bauthorization\b/i);
    expect(source).not.toMatch(/native_diagnostic\s*:[\s\S]{0,400}\btoken\b/i);
  });
});
