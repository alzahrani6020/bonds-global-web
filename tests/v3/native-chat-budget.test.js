const fs = require('fs');
const path = require('path');

describe('Bonds Native chat generation budget', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'api', 'ai.js'),
    'utf8'
  );

  test('keeps native chat output below the canonical runtime ceiling', () => {
    const match = source.match(/router\.generate\([\s\S]*?max_tokens:\s*(\d+)/);
    expect(match).not.toBeNull();

    const maxTokens = Number(match[1]);
    expect(maxTokens).toBe(96);
    expect(maxTokens).toBeLessThanOrEqual(512);
  });

  test('does not restore the previous 900-token chat budget', () => {
    expect(source).not.toMatch(/max_tokens:\s*900\b/);
  });


  test('does not force English users into an Arabic-only response contract', () => {
    expect(source).toContain('أجب بلغة آخر رسالة للمستخدم بأسلوب مختصر وواقعي.');
    expect(source).not.toContain('أجب بالعربية الفصحى بأسلوب مختصر وواقعي.');
  });
});
