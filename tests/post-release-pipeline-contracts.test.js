const fs = require('fs');
const path = require('path');

describe('post-release pipeline contracts', () => {
  test('production smoke uses canonical clean URLs and validates HTML', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/deploy-vercel.yml'),
      'utf8'
    );

    expect(workflow).toContain('"/calculators/investment-center"');
    expect(workflow).toContain('"/en/calculators/investment-center"');
    expect(workflow).not.toContain('/calculators/investment-center/index.html');
    expect(workflow).not.toContain('/en/calculators/investment-center/index.html');
    expect(workflow).toContain('grep -F "<!DOCTYPE html>"');
  });

  test('production promotion rejects stale content but permits equivalent Git trees', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/deploy-vercel.yml'),
      'utf8'
    );

    expect(workflow).toContain('Verify release candidate is current main');
    expect(workflow).toContain('git fetch origin main --depth=1');
    expect(workflow).toContain('current_tree="$(git rev-parse "$current_main^{tree}")"');
    expect(workflow).toContain('release_tree="$(git rev-parse "$release_sha^{tree}")"');
    expect(workflow).toContain('Refusing to promote stale release candidate with a different Git tree.');
    expect(workflow).toContain('Release SHA differs from current main, but the Git trees are identical.');
  });

  test('CI has a bounded runtime for hung browser suites', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/ci.yml'),
      'utf8'
    );

    expect(workflow).toContain('timeout-minutes: 15');
    expect(workflow).toContain('${{ github.workflow }}-${{ github.ref }}-bounded-v2');
  });
  test('authenticated production smoke sends bearer auth to Native chat probes', () => {
    const smoke = fs.readFileSync(
      path.resolve(__dirname, '../scripts/post-deploy-smoke.js'),
      'utf8'
    );

    expect(smoke).toContain('async function assertNativeProductionRuntime(token)');
    expect(smoke).toContain('Authorization: `Bearer ${token}`');
    expect(smoke).toContain('const token = await getAuthenticatedToken();');
    expect(smoke).toContain('await assertNativeProductionRuntime(token);');
  });

  test('service-token governance reuses the existing fail-closed verifier', () => {
    const verifier = fs.readFileSync(
      path.resolve(__dirname, '../lib/security/service-token-verifier.js'),
      'utf8'
    );
    const gateway = fs.readFileSync(
      path.resolve(__dirname, '../lib/capabilities/governance-gateway.js'),
      'utf8'
    );
    const executor = fs.readFileSync(
      path.resolve(__dirname, '../lib/capabilities/governed-executor.js'),
      'utf8'
    );
    const httpRouter = fs.readFileSync(
      path.resolve(__dirname, '../v3/api/capabilities.js'),
      'utf8'
    );

    expect(verifier).toContain('BONDS_TOKEN_INTROSPECTION_URL');
    expect(verifier).toContain('TOKEN_VERIFIER_UNCONFIGURED');
    expect(verifier).toContain('TOKEN_INTROSPECTION_FAILED');
    expect(gateway).toContain('context.auth?.serviceToken');
    expect(gateway).toContain('authorizeServiceToken');
    expect(executor).toContain('evaluateGovernance');
    expect(httpRouter).toContain('if (!user) return sendJson(res, 401');
    expect(httpRouter).not.toContain('serviceToken: req.headers.authorization');
  });

  test('dedicated service token is passed to governed execution without reusing user bearer', () => {
    const router = fs.readFileSync(path.resolve(__dirname, '../v3/api/capabilities.js'), 'utf8');
    expect(router).toContain("req.headers['x-bonds-service-token']");
    expect(router).not.toContain('serviceToken: body.');
    expect(router).not.toContain('serviceToken: req.headers.authorization');
  });

  test('strict readiness requires the existing runtime contract and channel verification', () => {
    const health = fs.readFileSync(path.resolve(__dirname, '../api/health.js'), 'utf8');
    expect(health).toContain('BONDS_TOKEN_RUNTIME_HEALTH_URL');
    expect(health).toContain('resolveRuntimeIdentityExpectation');
    expect(health).toContain("require('../services/bonds_token_runtime/contract.json')");
    expect(health).toContain("token_runtime: tokenRuntime.status");
    expect(health).toContain("coreHealthy && inferenceReady && tokenRuntime.status === 'ok'");
    expect(health).not.toContain('!tokenRuntime.required');
  });

  test('capability service token header is permitted by V3 CORS preflight', () => {
    const api = fs.readFileSync(path.resolve(__dirname, '../v3/api/index.js'), 'utf8');
    expect(api).toContain('Content-Type,Authorization,x-admin-token,x-bonds-service-token');
  });

  test('existing forward migrations are immutable after merge', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/apply-migrations.yml'),
      'utf8'
    );

    expect(workflow).toContain('--diff-filter=MD');
    expect(workflow).toContain('Existing forward migration files are immutable once merged.');
    expect(workflow).toContain('Create a new recovery migration instead of modifying or deleting:');
  });
});
