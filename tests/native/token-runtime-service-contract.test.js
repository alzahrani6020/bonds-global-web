/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const win = path.join(root, 'services', 'bonds_token_runtime', 'windows');
const installer = fs.readFileSync(path.join(win, 'install-token-service.ps1'), 'utf8');
const service = fs.readFileSync(path.join(win, 'token_service.py'), 'utf8');

describe('Bonds token runtime Windows service', () => {
  test('uses SCM Automatic startup and recovery', () => {
    expect(installer).toContain('BondsTokenRuntimeService');
    expect(installer).toContain('--startup auto');
    expect(installer).toContain('sc.exe failure BondsTokenRuntimeService');
    expect(service).toContain('win32serviceutil.ServiceFramework');
    expect(service).toContain('CREATE_NO_WINDOW');
  });

  test('preserves the existing admin secret', () => {
    expect(installer).toContain('Refusing to generate or rotate the admin secret');
    expect(installer).not.toContain('RandomNumberGenerator');
  });

  test('enforces the 8771 contract and health-checks cutover', () => {
    expect(installer).toContain('contract requires port 8771');
    expect(installer).toContain('service_token_ttl_seconds');
    expect(installer).toContain('3600');
    expect(installer).toContain('if (-not $healthy)');
  });
});
