const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../admin');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function walk(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (
      entry.isFile() &&
      /\.(js|html)$/i.test(entry.name)
    ) {
      files.push(full);
    }
  }

  return files;
}

describe('admin iframe session bridge hardening', () => {
  test('does not expose full admin sessions or refresh tokens in admin code', () => {
    const files = walk(ROOT);

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');

      expect(source).not.toContain('admin-session');
      expect(source).not.toContain('__ADMIN_SESSION');
      expect(source).not.toContain('refresh_token');
    }
  });

  test('dashboard sends access token only to embedded admin modules', () => {
    const dashboard = read('dashboard.html');

    expect(dashboard).toContain(
      "iframe.contentWindow.postMessage("
    );
    expect(dashboard).toContain(
      "{ type: 'admin-token', token }"
    );

    expect(dashboard).not.toContain(
      "{ type: 'admin-session'"
    );
  });

  test('admin embed accepts only the access-token bridge', () => {
    const embed = read('admin-embed.js');

    expect(embed).toContain(
      "if (!isEmbed) return;"
    );
    expect(embed).toContain(
      "if (e.origin !== location.origin) return;"
    );
    expect(embed).toContain(
      "if (e.source !== window.parent) return;"
    );
    expect(embed).toContain(
      "e.data.type !== 'admin-token'"
    );
    expect(embed).toContain(
      "typeof e.data.token === 'string'"
    );
    expect(embed).toContain(
      'token.length > 8192'
    );
    expect(embed).toContain(
      'window.__ADMIN_TOKEN = token'
    );
    expect(embed).toContain(
      "window.dispatchEvent(new Event('admin-token-ready'))"
    );
  });

  test('admin common helper reads the access token without session fallback', () => {
    const common = read('admin-common.js');

    expect(common).toContain(
      'let token = extractToken(global.__ADMIN_TOKEN);'
    );

    expect(common).not.toContain('__ADMIN_SESSION');
  });

  test('executive dashboard waits for access-token bridge only', () => {
    const app = read('executive-dashboard/app.js');

    expect(app).toContain(
      'const hasBridge = !!window.__ADMIN_TOKEN;'
    );
    expect(app).toContain(
      "window.addEventListener('admin-token-ready', start, { once: true })"
    );

    expect(app).not.toContain('admin-session-ready');
  });

  test('financial advisory refreshes on access-token bridge only', () => {
    const app = read('financial-advisory/app.js');

    expect(app).toContain(
      "window.addEventListener('admin-token-ready'"
    );

    expect(app).not.toContain('admin-session-ready');
  });
});
