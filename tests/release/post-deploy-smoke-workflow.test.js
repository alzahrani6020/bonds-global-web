const fs = require('fs');
const path = require('path');

describe('Production Authenticated Smoke workflow', () => {
  test('runs person identity verification only after the deployed Production Release smoke', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../.github/workflows/post-deploy-smoke.yml'),
      'utf8'
    );

    expect(source).toContain("workflow_run:");
    expect(source).toContain("workflows:");
    expect(source).toContain("- 'Production Release'");
    expect(source).toContain("PERSON_LOOKUP_SMOKE_ONLY: ''");
    expect(source).toContain("person-identity-smoke:");
    expect(source).toContain("needs: smoke");
    expect(source).toContain("PERSON_LOOKUP_SMOKE_ONLY: 'true'");
    expect(source).toContain("github.event_name != 'push'");
    // Release failure must not hide a separately deployed commit; the runtime
    // itself fails closed unless /api/health reports the exact expected SHA.
    expect(source).toContain("github.event.workflow_run.conclusion == 'failure'");
    expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
    const smoke = fs.readFileSync(path.join(__dirname, '../../scripts/post-deploy-smoke.js'), 'utf8');
    expect(smoke).toContain('await waitForMatchingProduction()');
    expect(smoke).toContain('Production deployment READY for commit');
    expect(source).toContain("needs: [smoke, person-identity-smoke]");
  });
});
