const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin iframe messaging security', () => {
  test('dashboard validates iframe height message origin and source', () => {
    const html = read('admin/dashboard.html');

    expect(html).toContain("event.origin !== location.origin");
    expect(html).toContain("event.source !== iframe.contentWindow");
    expect(html).toContain("event.data?.type !== 'iframe-height'");
    expect(html).toContain('Number.isFinite(height)');
    expect(html).toContain('Math.min(Math.max(height, 200), 20000)');
  });

  test('embedded admin module only accepts admin token from parent', () => {
    const js = read('admin/admin-embed.js');

    expect(js).toContain('if (!isEmbed) return;');
    expect(js).toContain('if (e.origin !== location.origin) return;');
    expect(js).toContain('if (e.source !== window.parent) return;');
    expect(js).toContain("e.data.type !== 'admin-token'");
    expect(js).toContain('token.length > 8192');
  });
});
