/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'services/bonds_native_inference/canonical-model.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'services/bonds_native_inference/README.md'), 'utf8');
const runbook = fs.readFileSync(path.join(root, 'docs/NATIVE_HOST_RECOVERY.md'), 'utf8');

describe('Native docs stay in sync with canonical-model.json', () => {
  test('README runtime line matches the manifest', () => {
    const rt = manifest.runtime;
    const line = `runtime: \`n_ctx=${rt.n_ctx}\`, \`n_threads=${rt.n_threads}\`, \`n_gpu_layers=${rt.n_gpu_layers}\`, \`max_tokens=${rt.max_tokens}\``;
    expect(readme).toContain(line);
  });

  test('recovery runbook quotes the manifest model settings and checksum prefix', () => {
    const rt = manifest.runtime;
    expect(runbook).toContain(`n_ctx=${rt.n_ctx}`);
    expect(runbook).toContain(manifest.sha256.slice(0, 8));
    expect(runbook).toContain(manifest.artifact);
  });

  test('recovery runbook references only scripts that exist', () => {
    const referenced = runbook.match(/\.\\services\\[A-Za-z0-9_\\.-]+\.ps1/g) || [];
    expect(referenced.length).toBeGreaterThan(4);
    for (const rel of new Set(referenced)) {
      expect(fs.existsSync(path.join(root, rel.replace(/^\.\\/, '').replace(/\\/g, '/')))).toBe(true);
    }
  });

  test('recovery runbook contains no secret-looking values', () => {
    expect(runbook).not.toMatch(/Bearer\s+[A-Za-z0-9+/=]{20,}/);
    expect(runbook).not.toMatch(/[A-Za-z0-9+/]{40,}={0,2}\s*$/m);
  });
});
