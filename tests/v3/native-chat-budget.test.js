const fs = require('fs');
const path = require('path');

describe('Bonds Native chat generation budget', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'api', 'ai.js'),
    'utf8'
  );

  test('uses an adaptive bounded chat budget instead of the legacy 48-token ceiling', () => {
    expect(source).toContain('function adaptiveNativeChatMaxTokens');
    expect(source).toContain('Math.max(80, Math.min(384, Math.floor(requested)))');
    expect(source).toContain('if (complex) return 320;');
    expect(source).toContain('return 112;');
    expect(source).toContain('max_tokens: maxTokens');
    expect(source).not.toContain('Math.min(48');
  });

  test('does not restore the previous 900-token chat budget', () => {
    expect(source).not.toMatch(/max_tokens:\s*900\b/);
  });

  test('does not force English users into an Arabic-only response contract', () => {
    expect(source).toContain('أجب بلغة آخر رسالة للمستخدم بأسلوب مختصر وواقعي.');
    expect(source).not.toContain('أجب بالعربية الفصحى بأسلوب مختصر وواقعي.');
  });

  test('bounds synchronous Native chat below the edge timeout ceiling', () => {
    expect(source).toContain('BONDS_NATIVE_CHAT_TIMEOUT_MS || 60000');
    expect(source).toContain('Math.min(60000');
    expect(source).not.toContain('timeoutMs: Number(process.env.BONDS_NATIVE_TIMEOUT_MS || 20000)');
  });

  test('requires authentication before any AI or legacy fallback path', () => {
    expect(source).toContain("error: 'AUTHENTICATION_REQUIRED'");
    expect(source).toContain('requires_authentication: true');
    expect(source).toContain('if (!forceNative)');
    expect(source).toContain('runOpenChatLoop(messages, enrichedContext, {');
    expect(source).not.toContain('const deterministicReply =');
    expect(source).not.toContain("source: 'data-driven'");
  });

  test('allows an explicit bounded BONDS AI probe within the runtime ceiling', () => {
    expect(source).toContain('adaptiveNativeChatMaxTokens(messages, options.maxTokens)');
    expect(source).toContain('Math.min(384');
    expect(source).toContain('options?.force_native === true');
  });

  test('keeps a bounded 8-12 message prompt with structured context layers', () => {
    expect(source).toContain("slice(-10)");
    expect(source).toContain("VERIFIED_BONDS_DATA=");
    expect(source).toContain("CONVERSATION_STATE=");
    expect(source).toContain("RECENT_MESSAGES=");
    expect(source).toContain("CURRENT_REQUEST=");
    expect(source).toContain("AVAILABLE_GOVERNED_ACTIONS=");
    expect(source).toContain("Never reveal, infer, or name any underlying model");
  });

  test('preserves long current user input instead of silently truncating it near 1-2k characters', () => {
    expect(source).toContain("index === rawRecent.length - 1 ? 12000 : 2400");
    expect(source).toContain("currentRequest.slice(0, 12000)");
    expect(source).toContain("compactJson(priorMessages, 12000)");
    expect(source).not.toContain("content: String(m?.content || '').slice(0, 1200)");
    expect(source).not.toContain("currentRequest.slice(0, 1600)");
  });

});
