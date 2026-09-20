const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin owner authority', () => {
  test('browser admin guard does not grant super_admin from owner email', () => {
    const auth = read('bonds-auth-2026.js');

    expect(auth).not.toContain('OWNER_EMAIL_FALLBACKS');
    expect(auth).not.toContain('getEnv().ADMIN_EMAIL');
    expect(auth).not.toContain("iiffund.dev@gmail.com");
  });

  test('server remains the authority for configured owner identity', () => {
    const adminApi = read('api/admin.js');

    expect(adminApi).toContain(
      'const CONFIGURED_OWNER_EMAIL = process.env.ADMIN_EMAIL'
    );
    expect(adminApi).toContain('function isOwner(email)');
    expect(adminApi).toContain('if (isOwner(user.email))');
  });

  test('server me endpoint returns the resolved admin role', () => {
    const adminApi = read('api/admin.js');

    expect(adminApi).toContain("if (action === 'me')");
    expect(adminApi).toContain(
      'const role = await getActorRole(sb, admin)'
    );
  });
});
