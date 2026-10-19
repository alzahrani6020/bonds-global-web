/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'services/bonds_native_inference/staging/manifest.json'), 'utf8'));
const start = fs.readFileSync(path.join(root, 'services/bonds_native_inference/staging/start-engine.ps1'), 'utf8');
const benchmark = fs.readFileSync(path.join(root, 'services/bonds_native_inference/staging/benchmark.ps1'), 'utf8');
const install = fs.readFileSync(path.join(root, 'services/bonds_native_inference/staging/install-engine.ps1'), 'utf8');

describe('Bonds Native staging harness contract', () => {
  test('pins verified CPU and Vulkan b11669 artifacts', () => {
    expect(manifest.stage).toBe('candidate-not-production');
    expect(manifest.engine.version).toBe('b11669');
    expect(manifest.engine.artifacts.cpu.sha256).toBe('37b3efcf962847ca869745fd4ccf7f5e7e8dacfeff9fa3523b4ca8cdc66d632b');
    expect(manifest.engine.artifacts.vulkan.sha256).toBe('2c07574e7bde71321cb785282b20cc821e951132149eeceeea32ddebdbf0598e');
  });

  test('reuses canonical model runtime instead of duplicating model settings', () => {
    expect(start).toContain("'canonical-model.json'");
    expect(benchmark).toContain("'canonical-model.json'");
    expect(benchmark).toContain('canonical.runtime.max_tokens');
    expect(start).toContain('canonical.runtime.n_ctx');
    expect(start).toContain('canonical.runtime.n_threads');
    expect(start).toContain('canonical.runtime.temperature');
    expect(start).toContain('Unexpected release file(s):');
  });

  test('stays loopback-only and rejects production ports', () => {
    expect(start).toContain("'--host', '127.0.0.1'");
    expect(start).toContain('$Port -eq 8765 -or $Port -eq 8771');
    expect(benchmark).toContain('$Port -eq 8765 -or $Port -eq 8771');
    expect(install).not.toContain('Register-ScheduledTask');
    expect(start).not.toContain('Register-ScheduledTask');
    expect(start).not.toContain('cloudflared');
  });
});
