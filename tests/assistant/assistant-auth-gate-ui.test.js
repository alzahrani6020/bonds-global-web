const fs = require('fs');
const path = require('path');

describe('BONDS assistant authentication gate UI', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
    'utf8'
  );

  test('turns assistant 401 into a sign-in prompt instead of a generic failure', () => {
    expect(source).toContain("res.status === 401 && data?.error === 'AUTHENTICATION_REQUIRED'");
    expect(source).toContain('addAuthenticationRequiredMessage();');
    expect(source).toContain('يلزم تسجيل الدخول لاستخدام مساعد بوندز.');
    expect(source).toContain("'/calculators/auth/'");
    expect(source).toContain("'/en/calculators/auth/'");
  });

  test('never blocks an interaction on a pending auth session init', () => {
    // The auth client can stay pending for seconds on a cold cache; header
    // collection must give up quickly and proceed anonymously instead of
    // swallowing the first click.
    expect(source).toContain('AUTH_SESSION_HEADER_TIMEOUT_MS = 1500');
    expect(source).toContain('Promise.race([');
    expect(source).toContain('setTimeout(() => resolve(null), AUTH_SESSION_HEADER_TIMEOUT_MS)');
    expect(source).toContain('sessionResult?.data?.session?.access_token');
  });
});
