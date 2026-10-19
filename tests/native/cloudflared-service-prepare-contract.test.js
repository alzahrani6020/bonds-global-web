/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const installer = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'bonds_native_inference', 'windows', 'install-cloudflared-service.ps1'),
  'utf8'
);

describe('cloudflared service prepare contract', () => {
  test('prepare mode exits before installing service or mutating active machine environment', () => {
    const prepareIndex = installer.indexOf('if (-not $Activate)');
    const installIndex = installer.indexOf('service install');
    const envMutationIndex = installer.indexOf('[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_EXE"');

    expect(prepareIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(prepareIndex);
    expect(envMutationIndex).toBeGreaterThan(installIndex);
    expect(installer).toContain('Active tunnel, Windows service, and machine environment were not changed');
  });

  test('failed activation restores legacy tunnel configuration', () => {
    expect(installer).toContain('Stop-Service -Name "cloudflared" -Force');
    expect(installer).toContain('[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", $legacyExe, "Machine")');
    expect(installer).toContain('[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", $legacyConfig, "Machine")');
    expect(installer).toContain('legacy task was restored');
  });
});
