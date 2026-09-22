const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin dynamic URL safety', () => {
  test('online users only opens same-origin http(s) tracked URLs', () => {
    const html = read('admin/online-users.html');

    expect(html).toContain("!['http:', 'https:'].includes(url.protocol)");
    expect(html).toContain('url.origin !== location.origin');
    expect(html).toContain('href="${safeTrackedUrl(u.url)}"');
    expect(html).toContain('href="${safeTrackedUrl(j.url)}"');
  });

  test('users journey only opens same-origin http(s) tracked URLs', () => {
    const html = read('admin/users.html');

    expect(html).toContain("!['http:', 'https:'].includes(url.protocol)");
    expect(html).toContain('url.origin !== location.origin');
    expect(html).toContain('href="${safeTrackedUrl(j.url)}"');
  });
});
