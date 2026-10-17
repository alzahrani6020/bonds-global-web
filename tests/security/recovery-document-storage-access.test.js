const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SERVICE = path.join(ROOT, 'admin/distressed-recovery/service.js');

describe('recovery document storage access', () => {
  const source = fs.readFileSync(SERVICE, 'utf8');

  test('private recovery documents are read through signed URLs', () => {
    expect(source).toMatch(
      /from\('recovery-documents'\)[\s\S]*createSignedUrl\(doc\.storage_path,\s*900\)/i
    );
  });

  test('upload flow does not generate a public storage URL', () => {
    expect(source).not.toMatch(
      /from\('recovery-documents'\)[\s\S]*getPublicUrl\(/i
    );
    expect(source).toMatch(
      /storage_path:\s*path,[\s\S]*public_url:\s*null/i
    );
  });
});
