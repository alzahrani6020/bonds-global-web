const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('homepage illustrative market data labels', () => {
  test('Arabic homepage does not present static market figures as live', () => {
    const html = read('index.html');

    expect(html).not.toContain('<span>LIVE</span>');
    expect(html).toContain('بيانات توضيحية');
    expect(html).toContain('نموذج توضيحي');
  });

  test('English homepage does not present static market figures as live', () => {
    const html = read('en/index.html');

    expect(html).not.toContain('<span>LIVE</span>');
    expect(html).toContain('<span>ILLUSTRATIVE</span>');
  });
});
