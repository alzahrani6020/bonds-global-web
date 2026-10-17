const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../../v3/api/auth.js'),
  'utf8'
);

describe('OTP verification hardening', () => {
  test('rate limits verification by IP and email', () => {
    expect(source).toContain("checkOtpRateLimit('verify-ip'");
    expect(source).toContain("checkOtpRateLimit('verify-email'");
    expect(source).toContain("checkRateLimitDistributed(");
    expect(source).toContain("'otp-verify-ip'");
    expect(source).toContain("'otp-verify-email'");
    expect(source).toContain("return sendJson(res, 429");
  });

  test('consumes OTP metadata before issuing a session', () => {
    const consumeIndex = source.indexOf("consume OTP error");
    const magicLinkIndex = source.indexOf("adminClient.auth.admin.generateLink");
    const passwordLoginIndex = source.indexOf("authClient.auth.signInWithPassword");

    expect(consumeIndex).toBeGreaterThan(-1);
    expect(magicLinkIndex).toBeGreaterThan(consumeIndex);
    expect(passwordLoginIndex).toBeGreaterThan(consumeIndex);
    expect(source).toContain("delete updatedMetadata.bonds_otp");
    expect(source).toContain("delete updatedMetadata.bonds_otp_expires_at");
  });
});
