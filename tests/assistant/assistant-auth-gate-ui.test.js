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
});
