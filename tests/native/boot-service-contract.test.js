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

describe('Bonds Native boot service contract', () => {
  test('runtime is installed as an automatic Windows service with SCM recovery', () => {
    expect(runtimeInstaller).toContain('BondsNativeRuntimeService');
    expect(runtimeInstaller).toContain('--startup auto');
    expect(runtimeInstaller).toContain('sc.exe failure BondsNativeRuntimeService');
    expect(runtimeInstaller).toContain('BONDS_NATIVE_RUNTIME_ROOT');
    expect(serviceHost).toContain('win32serviceutil.ServiceFramework');
  });

  test('runtime cutover preserves the legacy task until service health passes', () => {
    expect(runtimeInstaller).toContain('if (-not $Activate)');
    expect(runtimeInstaller).toContain('Test-LocalHealth');
    expect(runtimeInstaller).toContain('Disable-ScheduledTask -TaskName "BondsNativeRuntime"');
    expect(runtimeInstaller).toContain('legacy runtime was restored');
  });

  test('cloudflared uses its official Windows service and machine-owned config', () => {
    expect(tunnelInstaller).toContain('service install');
    expect(tunnelInstaller).toContain('ProgramData');
    expect(tunnelInstaller).toContain('credentials-file');
    expect(tunnelInstaller).toContain('sc.exe config cloudflared');
    expect(tunnelInstaller).toContain('sc.exe failure cloudflared');
  });

  test('cloudflared prepare mode is non-mutating', () => {
    const prepareIndex = tunnelInstaller.indexOf('if (-not $Activate)');
    const installIndex = tunnelInstaller.indexOf('service install');
    const envMutationIndex = tunnelInstaller.indexOf('[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_EXE"');
    expect(prepareIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(prepareIndex);
    expect(envMutationIndex).toBeGreaterThan(installIndex);
    expect(tunnelInstaller).toContain('Active tunnel, Windows service, and machine environment were not changed');
  });

  test('tunnel cutover verifies remote health before disabling the legacy task', () => {
    const probeIndex = tunnelInstaller.indexOf('if (-not $healthy)');
    const disableIndex = tunnelInstaller.indexOf('Disable-ScheduledTask -TaskName "BondsNativeTunnel"');
    expect(probeIndex).toBeGreaterThan(-1);
    expect(disableIndex).toBeGreaterThan(probeIndex);
    expect(tunnelInstaller).toContain('legacy task was restored');
    expect(tunnelInstaller).toContain('Stop-Service -Name "cloudflared" -Force');
  });
});
