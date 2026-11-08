const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('post-deploy staged Vercel curl contract', () => {
  test('targets the exact protected deployment with native Vercel curl URL syntax and preserves app Authorization', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/post-deploy-smoke.js'), 'utf8');

    expect(source).toContain("const target = new URL(url);");
    expect(source).toContain("const requestUrl = target.toString();");
    expect(source).toContain("['--no-install', 'vercel', 'curl', requestUrl, '--fail-with-body']");
    expect(source).not.toContain("matchAll(/^HTTP");
    expect(source).not.toContain("vercel curl did not return an HTTP status line");
    expect(source).toContain("res: { ok: true, status: 200 }");
    expect(source).not.toContain("'--deployment', deployment");
    expect(source).not.toContain("'-sS'");
    expect(source).toContain("Authorization: \`Bearer ${token}\`");
    expect(source).toContain("async function assertPersonLookupSmoke(token)");
    expect(source).toContain("const request = String(process.env.PERSON_LOOKUP_USE_VERCEL_CURL || '').toLowerCase() === 'true'");
    expect(source).toContain("const chat = await request(\`${cfg.baseUrl}/api/v3/ai/chat\`, {");
  });

  test('enforces person lookup semantic output contract', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/post-deploy-smoke.js'), 'utf8');

    expect(source).toContain("لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.");
    expect(source).toContain("forbiddenIdentityHosts");
    expect(source).toContain("'linkedin.com'");
    expect(source).toContain("'youtube.com'");
    expect(source).toContain("reply.indexOf('المصادر:')");
    expect(source).toContain("publisherGroups.size < 2");
    expect(source).toContain("officialPrimaryOnly");
    expect(source).toContain("replyUrls.length !== 1");
    expect(source).toContain("semantic_contract=");
  });


  test('post-deploy smoke script parses as valid JavaScript', () => {
    const filename = path.join(__dirname, '../../scripts/post-deploy-smoke.js');
    expect(() => execFileSync(process.execPath, ['--check', filename], { stdio:'pipe' })).not.toThrow();
  });

});
