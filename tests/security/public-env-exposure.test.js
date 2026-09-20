const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('public runtime environment exposure', () => {
  test('api/env does not expose admin owner email', () => {
    const env = read('api/env.js');

    expect(env).not.toContain('ADMIN_EMAIL:');
    expect(env).not.toContain('process.env.ADMIN_EMAIL');
    expect(env).not.toContain('process.env.ADMIN_EMAILS');
  });

  test('server admin API still owns admin email configuration', () => {
    const admin = read('api/admin.js');

    expect(admin).toContain('process.env.ADMIN_EMAIL');
    expect(admin).toContain('function isOwner(email)');
  });
});
