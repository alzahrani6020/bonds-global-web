/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const dir = path.join(root, 'services/bonds_native_inference/windows');
const supervisor = fs.readFileSync(path.join(dir, 'service-supervisor.ps1'), 'utf8');
const installer = fs.readFileSync(path.join(dir, 'install-service-supervisor.ps1'), 'utf8');
const legacyWatchdog = fs.readFileSync(path.join(dir, 'watchdog.ps1'), 'utf8');

describe('Bonds service supervisor contract', () => {
  test('supervises the three Windows services, not retired scheduled tasks', () => {
    expect(supervisor).toContain('BondsNativeRuntimeService');
    expect(supervisor).toContain('BondsTokenRuntimeService');
    expect(supervisor).toContain('"Cloudflared"');
    expect(supervisor).not.toContain('Start-ScheduledTask');
    expect(supervisor).not.toContain('Get-ScheduledTask');
  });

  test('probes native, token runtime and the public tunnel', () => {
    expect(supervisor).toContain('http://127.0.0.1:8765/health');
    expect(supervisor).toContain('http://127.0.0.1:8771/health');
    expect(supervisor).toContain('https://native.bonds-global.com/health');
    expect(supervisor).toContain('Authorization = "Bearer $nativeToken"');
    // token runtime is probed unauthenticated: 401 proves it is alive, no secret is handled
    expect(supervisor).toContain('$p.status -eq 200 -or $p.status -eq 401');
  });

  test('has restart-storm safeguards', () => {
    expect(supervisor).toContain('[int]$FailureThreshold = 3');
    expect(supervisor).toContain('[int]$CooldownSeconds = 300');
    expect(supervisor).toContain('[int]$MaxRestartsPerHour = 6');
    expect(supervisor).toContain('[int]$StartupGraceSeconds = 180');
    expect(supervisor).toContain('GAVE UP service=');
    expect(supervisor).toContain('restart suppressed service=');
    expect(supervisor).toContain('supervisor.paused');
    expect(supervisor).toMatch(/\$ServiceState -match "Pending\$"/);
  });

  test('does not restart the tunnel for local or network failures', () => {
    expect(supervisor).toContain('if ($nativeHealthy) {');
    expect(supervisor).toContain('Test-InternetReachable');
    expect(supervisor).toContain('"network_down"');
  });

  test('-Once is report-only and implies dry run', () => {
    expect(supervisor).toContain('if ($Once) { $DryRun = $true }');
    expect(supervisor).toContain('if ($Once) { return $Target.lastResult }');
  });

  test('applies startup grace after sleep/resume', () => {
    expect(supervisor).toContain('resume detected');
  });

  test('installer registers a SYSTEM startup task that keeps running on battery', () => {
    expect(installer).toContain('-UserId "SYSTEM"');
    expect(installer).toContain('New-ScheduledTaskTrigger -AtStartup');
    expect(installer).toContain('-AllowStartIfOnBatteries');
    expect(installer).toContain('-DontStopIfGoingOnBatteries');
    expect(installer).toContain('-MultipleInstances IgnoreNew');
    expect(installer).toContain('[switch]$RemoveLegacyWatchdog');
    expect(installer).toContain('[switch]$Uninstall');
  });

  test('legacy watchdog is marked deprecated', () => {
    expect(legacyWatchdog).toMatch(/DEPRECATED/);
    expect(legacyWatchdog).toContain('service-supervisor.ps1');
  });

  test('no secrets are embedded', () => {
    expect(supervisor).not.toMatch(/Bearer [A-Za-z0-9+/=]{20,}/);
    expect(installer).not.toMatch(/Bearer [A-Za-z0-9+/=]{20,}/);
  });
});
