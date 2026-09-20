const fs = require('fs');
const path = require('path');

describe('admin dashboard XSS hardening', () => {
  let html;

  beforeAll(() => {
    html = fs.readFileSync(
      path.join(__dirname, '../../admin/dashboard.html'),
      'utf8'
    );
  });

  test('defines escaping helpers', () => {
    expect(html).toContain('function escapeHtml(value)');
    expect(html).toContain('function safeTrackedUrl(value)');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
  });

  test('restricts tracked links to same-origin http or https URLs', () => {
    expect(html).toContain("!['http:', 'https:'].includes(url.protocol)");
    expect(html).toContain('url.origin !== location.origin');
    expect(html).toContain('return escapeHtml(url.href)');
  });

  test('escapes tracked online-user fields before HTML rendering', () => {
    expect(html).toContain("const sessionId = escapeHtml(u.sessionId || '')");
    expect(html).toContain("const page = escapeHtml(u.page || '')");
    expect(html).toContain("const section = escapeHtml(u.section || u.page || '-')");
    expect(html).toContain("const lang = escapeHtml(u.lang || '-')");
    expect(html).toContain('escapeHtml(decodeCity(u.city))');
  });

  test('escapes journey fields before HTML rendering', () => {
    expect(html).toContain("escapeHtml(p.country || 'غير معروف')");
    expect(html).toContain("escapeHtml(p.city || '-')");
    expect(html).toContain("escapeHtml(j.section || j.page || '-')");
  });

  test('does not contain the previously vulnerable raw interpolations', () => {
    expect(html).not.toContain('href="${u.url');
    expect(html).not.toContain('title="${u.page');
    expect(html).not.toContain('>${u.section || u.page');
    expect(html).not.toContain('>${p.country ||');
    expect(html).not.toContain('>${p.city ||');
    expect(html).not.toContain('>${j.section || j.page');
  });

  test('protects links opened in a new tab', () => {
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
