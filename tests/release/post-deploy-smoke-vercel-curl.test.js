const fs = require('fs');
const path = require('path');

describe('post-deploy staged Vercel curl contract', () => {
  test('targets protected staged deployments through --deployment while preserving app Authorization', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/post-deploy-smoke.js'), 'utf8');

    expect(source).toContain("const target = new URL(url);");
    expect(source).toContain("const deployment = target.origin;");
    expect(source).toContain("const requestPath = \`${target.pathname}${target.search}\` || '/';");
    expect(source).toContain("'--deployment', deployment");
    expect(source).toContain("Authorization: \`Bearer ${token}\`");
    expect(source).not.toContain("['--no-install', 'vercel', 'curl', url,");
    expect(source).toContain("async function assertPersonLookupSmoke(token)");
    expect(source).toContain("const request = String(process.env.PERSON_LOOKUP_USE_VERCEL_CURL || '').toLowerCase() === 'true'");
    expect(source).toContain("const chat = await request(\`${cfg.baseUrl}/api/v3/ai/chat\`, {");
  });
});
