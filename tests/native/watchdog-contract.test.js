/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const install = fs.readFileSync(path.join(root, 'services/bonds_native_inference/windows/install-startup.ps1'), 'utf8');
const watchdog = fs.readFileSync(path.join(root, 'services/bonds_native_inference/windows/watchdog.ps1'), 'utf8');

describe('Bonds Native watchdog contract', () => {
  test('watchdog is explicit opt-in and not registered by default', () => {
    expect(install).toContain('[switch]$EnableWatchdog');
    expect(install).toContain('if ($EnableWatchdog)');
    expect(install).toContain('if ($EnableWatchdog) {\n    Register-ScheduledTask -TaskName "BondsNativeWatchdog"');
    expect(install).toContain('if ($EnableWatchdog) {\n    Start-ScheduledTask -TaskName "BondsNativeWatchdog"');
  });

  test('watchdog uses failure threshold and restart cooldown safeguards', () => {
    expect(watchdog).toContain('[int]$FailureThreshold = 3');
    expect(watchdog).toContain('[int]$CooldownSeconds = 60');
    expect(watchdog).toContain('restart suppressed task=');
    expect(watchdog).toContain('$localFailures -ge $FailureThreshold');
    expect(watchdog).toContain('$remoteFailures -ge $FailureThreshold');
  });

  test('watchdog probes authenticated local and remote health endpoints', () => {
    expect(watchdog).toContain('Authorization = "Bearer $token"');
    expect(watchdog).toContain('http://127.0.0.1:8765/health');
    expect(watchdog).toContain('https://native.bonds-global.com/health');
  });
});
