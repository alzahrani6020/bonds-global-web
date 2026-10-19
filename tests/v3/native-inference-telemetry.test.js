const fs = require('fs');
const path = require('path');

describe('Native inference request telemetry', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'lib', 'ai', 'inference-router.js'),
    'utf8'
  );

  test('reports elapsed time for success, HTTP failure, and timeout', () => {
    expect(source).toContain('const startedAt = Date.now();');
    expect(source).toContain("meta: { elapsed_ms: Date.now() - startedAt }");
    expect(source).toMatch(/NATIVE_RUNTIME_HTTP_ERROR[\s\S]*elapsed_ms: Date\.now\(\) - startedAt/);
    expect(source).toMatch(/NATIVE_RUNTIME_TIMEOUT[\s\S]*elapsed_ms: Date\.now\(\) - startedAt/);
  });
});
