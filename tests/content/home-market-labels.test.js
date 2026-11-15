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
    expect(html).not.toContain('SPREAD');
    expect(html).not.toContain('SOFR');
    expect(html).toContain('رؤية أوسع لقرارات أدق');
    expect(html).toContain('الاعتماد على بيانات موثوقة');
  });

  test('English homepage does not present static market figures as live', () => {
    const html = read('en/index.html');

    expect(html).not.toContain('<span>LIVE</span>');
    // New homepage has no illustrative investment dashboard or fabricated live figures.
    expect(html).not.toContain('Portfolio Yield');
    expect(html).not.toContain('5.24%');
    expect(html).not.toContain('Mod. Duration');
    expect(html).toContain('Your partner in growth, finance');
    expect(html).toContain('bonds-hero');
  });
});
