const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

const filesWithBlankTargets = [
  'admin/city-intelligence/app.js',
  'admin/investment-intelligence/index.html',
  'admin/online-users.html',
  'admin/reset.html',
  'admin/users.html',
  'admin/funding-cases/app.js',
  'admin/distressed-recovery/app.js',
  'admin/social-media/app.js'
];

describe('admin external navigation hardening', () => {
  test('all target blank links use noopener', () => {
    for (const file of filesWithBlankTargets) {
      const text = read(file);
      const matches = [...text.matchAll(/target="_blank"([^>]*)>/g)];

      for (const match of matches) {
        expect(match[1]).toMatch(
          /rel="[^"]*noopener[^"]*"/
        );
      }
    }
  });

  test('window.open blank calls request noopener', () => {
    const advisory = read('admin/financial-advisory/app.js');
    const messages = read('admin/messages.html');

    expect(advisory).toContain(
      "window.open(url, '_blank', 'noopener,noreferrer');"
    );

    expect(messages).toContain(
      "'_blank', 'noopener,noreferrer'"
    );
  });
});
