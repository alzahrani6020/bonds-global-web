/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('V3 critical control-plane boundaries', () => {
  test('legacy V3 admin never accepts credentials from the URL or persistent localStorage', () => {
    for (const file of ['v3/admin/index.html', 'v3/admin/services.html']) {
      const source = read(file);
      expect(source).not.toContain("urlParams.get('token')");
      expect(source).not.toContain("localStorage.getItem('bondsAdminToken')");
      expect(source).not.toContain("localStorage.setItem('bondsAdminToken'");
      expect(source).toContain("sessionStorage");
    }
  });

  test('V3 admin API prefers authenticated bearer admins and uses constant-time legacy comparison', () => {
    const source = read('v3/api/admin.js');
    expect(source).toContain("supabase.auth.getUser(bearer)");
    expect(source).toContain("admin_roles");
    expect(source).toContain("crypto.timingSafeEqual");
    expect(source).toContain("V3_ADMIN_ALLOW_LEGACY_TOKEN");
  });

  test('orchestrator ignores caller-supplied tier and derives entitlement server-side', () => {
    const source = read('v3/api/index.js');
    expect(source).toContain("async function resolveRequestTier(req)");
    expect(source).toContain("body.userTier = entitlement.userTier");
    expect(source).toContain("body.userId = entitlement.user?.id || null");
    expect(source).toContain("status === 'active' || status === 'trialing'");
  });

  test('Native AI execution requires an authenticated user', () => {
    const source = read('v3/api/ai.js');
    expect(source).toContain("authenticatedUser = await getUserFromToken(req)");
    expect(source).toContain("Authentication required for Native AI execution");
    expect(source).toContain("NATIVE_AUTH_REQUIRED");
  });

  test('token service cutover refuses unknown listeners and restores known legacy runtime', () => {
    const source = read('services/bonds_token_runtime/windows/install-token-service.ps1');
    expect(source).toContain("Refusing to stop PID");
    expect(source).toContain("bonds_security\\.server");
    expect(source).toContain("automatic legacy rollback");
    expect(source).toContain("Start-Process -FilePath $pythonExe");
  });
});
