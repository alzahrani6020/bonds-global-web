const fs = require('fs');
const path = require('path');

describe('Native readiness probe contract', () => {
  const scriptPath = path.join(
    __dirname,
    '..',
    '..',
    'services',
    'bonds_native_inference',
    'windows',
    'verify-readiness.ps1'
  );
  const script = fs.readFileSync(scriptPath, 'utf8');

  test('probe is read-only and does not contain service/task mutation commands', () => {
    const forbidden = [
      /\bRestart-Service\b/i,
      /\bStart-Service\b/i,
      /\bStop-Service\b/i,
      /\bStart-ScheduledTask\b/i,
      /\bStop-ScheduledTask\b/i,
      /\bRegister-ScheduledTask\b/i,
      /\bUnregister-ScheduledTask\b/i,
      /\bSet-Service\b/i,
      /\bRemove-Item\b/i,
    ];

    for (const pattern of forbidden) {
      expect(script).not.toMatch(pattern);
    }
  });

  test('probe checks local, remote and production health independently', () => {
    expect(script).toContain('http://127.0.0.1:8765/health');
    expect(script).toContain('https://native.bonds-global.com/health');
    expect(script).toContain('https://bonds-global.com/api/readiness');
  });

  test('probe classifies material failure modes', () => {
    for (const classification of [
      'TUNNEL_ORIGIN_FAILURE',
      'AUTH_FAILURE',
      'TIMEOUT',
      'APPLICATION_HEALTH_FAILURE',
      'HTTP_FAILURE',
      'UNREACHABLE',
    ]) {
      expect(script).toContain(classification);
    }
  });

  test('probe does not print or serialize the bearer token', () => {
    expect(script).not.toMatch(/Write-(Host|Output)[^\r\n]*\$token/i);
    expect(script).not.toMatch(/token\s*=\s*\$token/i);
  });
});
