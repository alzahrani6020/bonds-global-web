const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin security center hardening', () => {
  test('security center waits for verified admin context before loading', () => {
    const html = read('admin/security.html');

    expect(html).toContain("window.addEventListener('admin-auth-ready', initSecurityCenter, { once: true })");
    expect(html).toContain('const canManageSecurity = !!data.currentAdmin?.isOwner');
    expect(html).toContain('if (!currentStatus?.currentAdmin?.isOwner)');
    expect(html).not.toContain("window.__ADMIN_ROLE !== 'super_admin'");
  });

  test('security center escapes database-backed content before innerHTML rendering', () => {
    const html = read('admin/security.html');

    expect(html).toContain('return BondsAdminCommon.escapeHtml(value)');
    expect(html).toContain("escapeHtml(u.name || 'مستخدم')");
    expect(html).toContain("escapeHtml(u.email || u.user_id || '—')");
    expect(html).toContain("escapeHtml(log.actor_email || '—')");
    expect(html).toContain("escapeHtml(log.action || '—')");
    expect(html).toContain('escapeHtml(w)');
    expect(html).toContain('escapeHtml(e.message)');
  });

  test('server reports current security actor and owner authority', () => {
    const api = read('api/admin.js');

    expect(api).toContain('async function getSecurityStatus(sb, admin)');
    expect(api).toContain('role: await getActorRole(sb, admin)');
    expect(api).toContain('isOwner: isOwner(admin.email)');
    expect(api).toContain('getSecurityStatus(sb, admin)');
  });

  test('MFA enforcement cannot be enabled until owner has a verified factor', () => {
    const api = read('api/admin.js');

    expect(api).toContain("sb.auth.admin.mfa.listFactors({ userId: admin.id })");
    expect(api).toContain("factors.some(f => f.status === 'verified')");
    expect(api).toContain('Owner MFA must be verified before enforcement can be enabled');
  });

  test('admin guard resolves roles through the server authority endpoint', () => {
    const auth = read('bonds-auth-2026.js');
    const guardStart = auth.indexOf('function initAdminGuard()');
    const guardEnd = auth.indexOf('// ── Session recovery', guardStart);
    const guard = auth.slice(guardStart, guardEnd);

    expect(guard).toContain("fetch('/api/admin?action=me'");
    expect(guard).not.toContain('getAdminRole(user.id)');
    expect(guard).not.toContain('getAdvisoryRole(user.id)');
  });

  test('server identity endpoint preserves advisory roles and centrally enforces MFA', () => {
    const api = read('api/admin.js');

    expect(api).toContain("if (action === 'me')");
    expect(api).toContain('const role = await getActorRole(sb, user)');
    expect(api).toContain("role === 'unknown'");
    expect(api).toContain('if (!(await checkAdminMfa(req, sb)))');
    expect(api).toContain("error: 'MFA required', role");
  });
});
