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
    expect(source).toContain("needs: [smoke, person-identity-smoke]");
  });
});
