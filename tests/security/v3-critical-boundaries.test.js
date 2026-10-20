/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('V3 critical control-plane boundaries', () => {
  test('legacy V3 admin never accepts credentials from URL or persistent localStorage', () => {
    for (const file of ['v3/admin/index.html', 'v3/admin/services.html']) {
      const source = read(file);
      expect(source).not.toContain("urlParams.get('token')");
      expect(source).not.toContain("localStorage.getItem('bondsAdminToken')");
      expect(source).not.toContain("localStorage.setItem('bondsAdminToken'");
      expect(source).toContain('sessionStorage');
    }
  });

  test('V3 admin prefers unified bearer sessions and constant-time legacy comparison', () => {
    const api = read('v3/api/admin.js');
    const index = read('v3/admin/index.html');
    expect(api).toContain('supabase.auth.getUser(bearer)');
    expect(api).toContain('crypto.timingSafeEqual');
    expect(api).toContain('V3_ADMIN_ALLOW_LEGACY_TOKEN');
    expect(index).toContain("Authorization: 'Bearer ' + bearerToken");
  });

  test('privileged V3 data-engine actions accept the same unified admin bearer session', () => {
    const source = read('v3/api/data-engine.js');
    expect(source).toContain('async function requireAdminAccess(req)');
    expect(source).toContain('supabase.auth.getUser(bearer)');
    expect(source).toContain('admin_roles');
    expect(source).toContain('crypto.timingSafeEqual');
    expect(source).toContain('await requireAdminAccess(req)');
  });

  test('V3 admin dynamic service views escape database-backed text', () => {
    const services = read('v3/admin/services.html');
    const index = read('v3/admin/index.html');
    expect(services).toContain("const esc=");
    expect(services).toContain('esc(s.name_ar)');
    expect(index).toContain('const esc = value =>');
    expect(index).toContain('esc(a.message)');
  });

  test('orchestrator derives tier server-side instead of trusting request body', () => {
    const source = read('v3/api/index.js');
    expect(source).toContain('async function resolveRequestTier(req)');
    expect(source).toContain('body.userTier = entitlement.userTier');
    expect(source).toContain("status === 'active' || status === 'trialing'");
  });

  test('Native AI execution is denied to unauthenticated callers', () => {
    const source = read('v3/api/ai.js');
    expect(source).toContain('authenticatedUser = await getUserFromToken(req)');
    expect(source).toContain('Authentication required for Native AI execution');
    expect(source).toContain('NATIVE_AUTH_REQUIRED');
  });

  test('token service cutover refuses unknown listeners and restores known runtime', () => {
    const source = read('services/bonds_token_runtime/windows/install-token-service.ps1');
    expect(source).toContain('Refusing to stop PID');
    expect(source).toContain('bonds_security\\.server');
    expect(source).toContain('runtime-rollback-snapshot');
    expect(source).toContain('No previous runtime snapshot is available for safe rollback.');
    expect(source).toContain('Start-Process -FilePath $pythonExe');
  });
});
