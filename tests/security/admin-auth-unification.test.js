const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const ADMIN_PAGES = [
  'admin/funding-sources.html',
  'en/admin/analytics.html',
  'en/admin/dashboard.html',
  'en/admin/messages.html',
  'en/admin/roles.html',
  'en/admin/subscriptions.html',
  'en/admin/users.html'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('admin authentication unification', () => {
  test('legacy admin auth guard files are removed', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'admin/admin-auth.js'))
    ).toBe(false);

    expect(
      fs.existsSync(path.join(ROOT, 'admin/admin-auth-v2.js'))
    ).toBe(false);
  });

  test.each(ADMIN_PAGES)(
    '%s uses the unified BondsAuth admin guard',
    page => {
      const html = read(page);

      expect(html).toContain(
        '<script src="/bonds-auth-2026.js?v=3.1.3"></script>'
      );

      expect(html).toContain(
        '<script>BondsAuth.initAdminGuard();</script>'
      );

      expect(html).not.toContain('admin-auth.js');
      expect(html).not.toContain('admin-auth-v2.js');
    }
  );

  test('unified admin auth source has no overlay fail-open timeout', () => {
    const auth = read('bonds-auth-2026.js');

    expect(auth).toContain('function initAdminGuard()');
    expect(auth).not.toContain('setTimeout(removeOverlay');
    expect(auth).not.toContain('always remove overlay');
  });
});
