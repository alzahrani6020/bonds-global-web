const fs = require('fs');
const path = require('path');

describe('Production Authenticated Smoke workflow', () => {
  test('supports person-only production verification on protected main pushes without redeploy', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../.github/workflows/post-deploy-smoke.yml'),
      'utf8'
    );

    expect(source).toContain("push:");
    expect(source).toContain("branches: [main]");
    expect(source).toContain("- 'scripts/post-deploy-smoke.js'");
    expect(source).toContain("github.event_name == 'push'");
    expect(source).toContain("PERSON_LOOKUP_SMOKE_ONLY: ${{ github.event_name == 'push' && 'true' || '' }}");
    expect(source).toContain("needs.smoke.result == 'success' && github.event_name != 'push'");
  });
});
