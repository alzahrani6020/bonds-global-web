'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const authSource = fs.readFileSync(path.join(root, 'bonds-auth-2026.js'), 'utf8');
const loginHtml = fs.readFileSync(path.join(root, 'calculators/auth/index.html'), 'utf8');
const hrSource = fs.readFileSync(path.join(root, 'my-bonds/crm/company-hr.js'), 'utf8');
const STABLE = 'https://bonds-global-web-git-fix-hr-clean-integration-20261120-dr-talal.vercel.app';

function getBody(name) {
  const re = new RegExp('  (?:async )?function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}');
  const match = authSource.match(re);
  if (!match) throw new Error('Missing function ' + name);
  return match[0];
}

function setup(origin, backend, pathname = '/calculators/auth') {
  const assigned = [];
  const calls = [];
  const window = {
    location: {
      origin,
      hostname: new URL(origin).hostname,
      pathname,
      search: '?redirect=%2Fmy-bonds%2Fcrm%3Fprogram%3Dhr',
      assign: value => assigned.push(value)
    }
  };
  const context = {
    URL,
    window,
    getEnv: () => ({ SUPABASE_URL: backend }),
    getRedirectUrl: () => origin + '/my-bonds/crm?program=hr',
    ensureEnv: async () => {},
    getSupabase: () => ({auth: {
      signInWithOAuth: args => {
        calls.push(args);
        return Promise.resolve({data: {url:'https://accounts.google.com/'}, error: null});
      }
    }}),
    oauthCallbackUrl: () => origin + '/calculators/auth'
  };
  vm.runInNewContext(getBody('hrPreviewAuthOrigin') + '\n' + getBody('signInWithOAuth'), context);
  return { context, assigned, calls };
}

describe('stable HR Staging OAuth handoff', () => {
  test('a temporary HR Preview navigates before OAuth and keeps HR redirect relative', async () => {
    const env = setup('https://bonds-global-luhf1ra3e-dr-talal.vercel.app',
      'https://gjwppwtgsecwmqlsmbmq.supabase.co');
    const result = await env.context.signInWithOAuth('google');
    expect(result.error).toBeNull();
    expect(env.calls).toHaveLength(0);
    expect(env.assigned).toHaveLength(1);
    const target = new URL(env.assigned[0]);
    expect(target.origin).toBe(STABLE);
    expect(target.pathname).toBe('/calculators/auth');
    expect(target.searchParams.get('redirect')).toBe('/my-bonds/crm?program=hr');
    expect(target.searchParams.get('start_provider')).toBe('google');
    expect(target.searchParams.has('access_token')).toBe(false);
  });

  test('English Preview retains the English login and HR destination', async () => {
    const env = setup('https://bonds-global-luhf1ra3e-dr-talal.vercel.app',
      'https://gjwppwtgsecwmqlsmbmq.supabase.co', '/en/calculators/auth');
    await env.context.signInWithOAuth('google');
    const target = new URL(env.assigned[0]);
    expect(target.origin).toBe(STABLE);
    expect(target.pathname).toBe('/en/calculators/auth');
    expect(target.searchParams.get('start_provider')).toBe('google');
  });

  test('stable Preview starts OAuth on the same host', async () => {
    const env = setup(STABLE,'https://gjwppwtgsecwmqlsmbmq.supabase.co');
    await env.context.signInWithOAuth('google');
    expect(env.assigned).toHaveLength(0);
    expect(env.calls).toHaveLength(1);
    expect(env.calls[0].provider).toBe('google');
    expect(env.calls[0].options.redirectTo).toBe(STABLE + '/calculators/auth');
  });

  test('production, local, and unrelated Preview do not change OAuth host', async () => {
    for (const [origin, backend] of [
      ['https://bonds-global.com', 'https://hutxsqzplyuqgnghsrcs.supabase.co'],
      ['http://localhost:3000', 'https://gjwppwtgsecwmqlsmbmq.supabase.co'],
      ['https://another-preview.vercel.app', 'https://gjwppwtgsecwmqlsmbmq.supabase.co'],
      ['https://bonds-global-luhf1ra3e-dr-talal.vercel.app','https://hutxsqzplyuqgnghsrcs.supabase.co']
    ]) {
      const env = setup(origin, backend);
      await env.context.signInWithOAuth('google');
      expect(env.assigned).toHaveLength(0);
      expect(env.calls).toHaveLength(1);
      expect(env.calls[0].options.redirectTo).toBe(origin + '/calculators/auth');
    }
  });

  test('HR sign-in link uses the durable Staging host without losing HR query', () => {
    expect(hrSource).toContain("window.BondsAuth.hrPreviewAuthOrigin?.()||location.origin");
    expect(hrSource).toContain("encodeURIComponent(location.pathname+location.search)");
    expect(hrSource).toContain("+'/calculators/auth?redirect='");
  });

  test('both languages load the updated OAuth and HR JS instead of old SW cache keys', () => {
    for (const pathPart of ['calculators/auth/index.html','en/calculators/auth/index.html',
      'my-bonds/crm/index.html','en/my-bonds/crm/index.html']) {
      const html = fs.readFileSync(path.join(root, pathPart), 'utf8');
      expect(html).toContain('/bonds-auth-2026.js?v=3.1.5');
      if (pathPart.includes('/crm/')) {
        expect(html).toContain('/my-bonds/crm/company-hr.js?v=13');
      }
    }
  });

  test('stable callback page consumes the one-time flag before beginning OAuth', () => {
    expect(loginHtml).toContain("const pendingProvider = new URLSearchParams(location.search).get('start_provider')");
    expect(loginHtml).toContain("clean.searchParams.delete('start_provider')");
    expect(loginHtml).toContain("history.replaceState(null, '', clean.pathname + clean.search + clean.hash)");
    expect(loginHtml).toContain("else if (pendingProvider === 'google')");
  });
});
