/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const win = path.join(root, 'services', 'bonds_native_inference', 'windows');
const runtimeInstaller = fs.readFileSync(path.join(win, 'install-runtime-service.ps1'), 'utf8');
const tunnelInstaller = fs.readFileSync(path.join(win, 'install-cloudflared-service.ps1'), 'utf8');
const serviceHost = fs.readFileSync(path.join(win, 'native_service.py'), 'utf8');

describe('Bonds Native durable boot services', () => {
  test('runtime uses SCM automatic startup and recovery', () => {
    expect(runtimeInstaller).toContain('BondsNativeRuntimeService');
    expect(runtimeInstaller).toContain('--startup auto');
    expect(runtimeInstaller).toContain('sc.exe failure BondsNativeRuntimeService');
    expect(serviceHost).toContain('win32serviceutil.ServiceFramework');
    expect(serviceHost).toContain('CREATE_NO_WINDOW');
  });

  test('runtime service gets explicit service-scoped environment', () => {
    expect(runtimeInstaller).toContain('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\BondsNativeRuntimeService');
    expect(runtimeInstaller).toContain('-PropertyType MultiString');
    expect(runtimeInstaller).toContain('BONDS_NATIVE_RUNTIME_ROOT=');
    expect(runtimeInstaller).not.toContain('SetEnvironmentVariable("BONDS_NATIVE_MODEL_PATH"');
    expect(runtimeInstaller).toContain('Refusing to generate or rotate the production token');
  });

  test('runtime cutover preserves legacy task until service health passes', () => {
    const healthIndex = runtimeInstaller.indexOf('if (-not $healthy)');
    const disableIndex = runtimeInstaller.indexOf('Disable-ScheduledTask -TaskName "BondsNativeRuntime"');
    expect(healthIndex).toBeGreaterThan(-1);
    expect(disableIndex).toBeGreaterThan(healthIndex);
    expect(runtimeInstaller).toContain('legacy runtime was restored');
  });

  test('cloudflared prepare remains non-mutating', () => {
    const prepareIndex = tunnelInstaller.indexOf('if (-not $Activate)');
    const installIndex = tunnelInstaller.indexOf('service install');
    expect(prepareIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(prepareIndex);
  });
});
