const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('letterhead security and auth UX hardening', () => {
  test('letterhead clean routes remain protected by the global auth gate', () => {
    const gate = read('global-auth-gate.js');
    expect(gate).toContain("'/letterhead'");
    expect(gate).toContain("'/en/letterhead'");
  });

  test('Arabic aliases resolve to the canonical protected letterhead route', () => {
    const config = JSON.parse(read('vercel.json'));
    const redirects = config.redirects || [];
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/ar/letterhead', destination: '/letterhead', statusCode: 301 }),
      expect.objectContaining({ source: '/ar/letterhead.html', destination: '/letterhead', statusCode: 301 })
    ]));
  });

  test('letterhead UI never accepts an arbitrary manager recipient', () => {
    for (const rel of ['letterhead.html', 'en/letterhead.html']) {
      const html = read(rel);
      expect(html).not.toMatch(/prompt\(['"](?:بريد المدير|Manager email):/);
      expect(html).not.toContain("manager_email");
      expect(html).not.toMatch(/JSON\.stringify\(\{\s*to:/);
    }
  });

  test('legacy direct-send is disabled and governed correspondence route is present', () => {
    const platform = read('api/platform.js');
    const vercel = read('vercel.json');
    expect(platform).toContain("Legacy direct-send is intentionally disabled");
    expect(platform).toContain("'/api/correspondence'");
    expect(platform).toContain("correspondence.handler(req, res)");
    expect(vercel).toContain('"/api/correspondence"');
  });

  test('letterhead pages load the dynamic governance client and are noindex', () => {
    for (const rel of ['letterhead.html', 'en/letterhead.html']) {
      const html = read(rel);
      expect(html).toContain('/components/letterhead-correspondence.js');
      expect(html).toContain('name="robots" content="noindex,nofollow"');
    }
  });

  test('auth copy is organization-neutral and letterhead-aware', () => {
    const ar = read('calculators/auth/index.html');
    const en = read('en/calculators/auth/index.html');

    expect(ar).toContain('اسم المنشأة / الشركة *');
    expect(ar).not.toContain('اسم المطعم / الشركة *');
    expect(ar).toContain('سجّل الدخول للمتابعة إلى محرر المراسلات الرسمي في بوندز.');

    expect(en).toContain('Organization / Company Name *');
    expect(en).not.toContain('Restaurant / Company Name *');
    expect(en).toContain('Sign in to continue to the official Bonds correspondence editor.');
  });
});
