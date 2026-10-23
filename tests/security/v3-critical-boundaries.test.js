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

  test('V3 admin prefers unified bearer sessions and constant-time static-token comparison', () => {
    const helper = read('v3/lib/admin-access.js');
    const api = read('v3/api/admin.js');
    const index = read('v3/admin/index.html');
    expect(helper).toContain('supabase.auth.getUser(bearer)');
    expect(helper).toContain('crypto.timingSafeEqual');
    expect(helper).toContain('admin_roles');
    expect(helper).toContain("legacyFlagEnv = 'V3_ADMIN_ALLOW_LEGACY_TOKEN'");
    expect(api).toContain("require('../lib/admin-access')");
    expect(index).toContain("headers.Authorization = 'Bearer ' + bearerToken");
  });

  test('privileged V3 data-engine actions use the same unified admin access policy', () => {
    const source = read('v3/api/data-engine.js');
    expect(source).toContain("require('../lib/admin-access')");
    expect(source).toContain('await requireAdminAccess(req)');
  });

  test('public feedback is quarantined and cannot directly train correction factors', () => {
    const api = read('v3/api/data-engine.js');
    const feedback = read('v3/engine/data-acquisition/FeedbackEngine.js');
    expect(api).toContain("supabase.from('data_feedback').insert");
    expect(api).toContain("status: 'pending'");
    expect(api).not.toContain("supabase.from('metric_feedback').insert({\n      metric_code: body.metric_code");
    expect(feedback).toContain(".in('source', ['admin', 'audit', 'external'])");
  });

  test('all privileged V3 admin mutation surfaces share the centralized policy', () => {
    for (const file of [
      'v3/api/alerts.js',
      'v3/api/sector-data.js',
      'v3/api/water-factory-data.js',
      'v3/api/index.js'
    ]) {
      expect(read(file)).toContain("require('../lib/admin-access')");
    }
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

  test('all assistant execution is denied to unauthenticated callers before AI or fallback routing', () => {
    const source = read('v3/api/ai.js');
    expect(source).toContain('authenticatedUser = await getUserFromToken(req)');
    expect(source).toContain("error: 'AUTHENTICATION_REQUIRED'");
    expect(source).toContain('requires_authentication: true');
    expect(source).toContain('return sendJson(res, 401');
    expect(source).not.toContain('NATIVE_AUTH_REQUIRED');
    expect(source).not.toContain('const deterministicReply =');
  });

  test('token service cutover refuses unknown listeners and restores known runtime', () => {
    const source = read('services/bonds_token_runtime/windows/install-token-service.ps1');
    expect(source).toContain('Port 8771 is not exclusively owned by the managed loopback service.');
    expect(source).toContain('bonds_security\\.server');
    expect(source).toContain('runtime-rollback-');
    expect(source).toContain('Previous source is incomplete; rollback is unavailable.');
    expect(source).toContain('Set-ServiceEnvironment $previousEnvironment');
    expect(source).toContain('Keep the same database, including revocations committed after backup.');
    expect(source).not.toContain('Stop-Process');
  });
});
