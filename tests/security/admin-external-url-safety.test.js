const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '../..');

function loadCommon() {
  const source = fs.readFileSync(
    path.join(ROOT, 'admin/admin-common.js'),
    'utf8'
  );

  const window = {};
  vm.runInNewContext(source, { window, URL });

  return window.BondsAdminCommon;
}

describe('admin external URL safety', () => {
  test('allows HTTPS URLs', () => {
    const common = loadCommon();

    expect(
      common.safeExternalUrl('https://example.com/file.pdf')
    ).toBe('https://example.com/file.pdf');
  });

  test('allows local HTTP only for development', () => {
    const common = loadCommon();

    expect(
      common.safeExternalUrl('http://localhost:54321/test')
    ).toBe('http://localhost:54321/test');

    expect(
      common.safeExternalUrl('http://127.0.0.1:54321/test')
    ).toBe('http://127.0.0.1:54321/test');
  });

  test('rejects unsafe or non-HTTPS external protocols', () => {
    const common = loadCommon();

    expect(common.safeExternalUrl('javascript:alert(1)')).toBe('');
    expect(common.safeExternalUrl('data:text/html,test')).toBe('');
    expect(common.safeExternalUrl('file:///etc/passwd')).toBe('');
    expect(common.safeExternalUrl('http://example.com/test')).toBe('');
    expect(common.safeExternalUrl('not a url')).toBe('');
  });

  test('dynamic admin links use the shared URL validator', () => {
    const read = file =>
      fs.readFileSync(path.join(ROOT, file), 'utf8');

    expect(read('admin/city-intelligence/app.js'))
      .toContain('safeExternalUrl(r.pdf_url)');

    expect(read('admin/distressed-recovery/app.js'))
      .toContain('safeExternalUrl(d.public_url)');

    expect(read('admin/funding-cases/app.js'))
      .toContain('safeExternalUrl(d.signedUrl)');

    expect(read('admin/financial-advisory/app.js'))
      .toContain('safeExternalUrl(signedUrl)');

    expect(read('admin/social-media/app.js'))
      .toContain('safeExternalUrl(p.permalink)');

    expect(read('admin/social-media/app.js'))
      .toContain('safeExternalUrl(p.mediaUrl)');
  });
});
