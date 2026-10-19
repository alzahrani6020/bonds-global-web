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
    expect(maxTokens).toBe(48);
    expect(maxTokens).toBeLessThanOrEqual(512);
  });

  test('does not restore the previous 900-token chat budget', () => {
    expect(source).not.toMatch(/max_tokens:\s*900\b/);
  });


  test('does not force English users into an Arabic-only response contract', () => {
    expect(source).toContain('أجب بلغة آخر رسالة للمستخدم بأسلوب مختصر وواقعي.');
    expect(source).not.toContain('أجب بالعربية الفصحى بأسلوب مختصر وواقعي.');
  });

  test('bounds synchronous Native chat below the edge timeout ceiling', () => {
    expect(source).toContain('BONDS_NATIVE_CHAT_TIMEOUT_MS || 45000');
    expect(source).toContain('Math.min(60000');
    expect(source).not.toContain('timeoutMs: Number(process.env.BONDS_NATIVE_TIMEOUT_MS || 20000)');
  });

  test('serves deterministic sourced answers before attempting Native inference', () => {
    expect(source).toContain("const deterministicReply = forceNative ? null : generateDataDrivenReply");
    expect(source).toContain("source: 'data-driven'");
    expect(source).toContain("native_attempted: false");
  });

  test('allows an explicit bounded Native probe without raising the chat ceiling', () => {
    expect(source).toContain('clampNativeChatMaxTokens(options.maxTokens)');
    expect(source).toContain('Math.min(48');
    expect(source).toContain('options?.force_native === true');
  });

});
