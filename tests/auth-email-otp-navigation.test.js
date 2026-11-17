'use strict';

const fs = require('fs');
const path = require('path');

describe.each(['calculators/auth/index.html', 'en/calculators/auth/index.html'])('%s email login', file => {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  test('both successful send paths open the existing code entry page', () => {
    const begin = html.indexOf('function continueEmailOtp(email) {');
    const end = html.indexOf('\n      }', begin) + 8;
    expect(begin).toBeGreaterThan(-1);
    const values = new Map([
      ['otp_phone', '+15550000000'], ['otp_pending_password', 'test-only'],
      ['otp_pending_name', 'stale signup'], ['auth_redirect', '/letterhead?document=test-new']
    ]);
    const sessionStorage = {
      setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k)
    };
    const window = { location: { href: '' }, BondsAuth: { getRedirectUrl: jest.fn() } };
    const run = new Function('sessionStorage', 'window', html.slice(begin, end) + '\nreturn continueEmailOtp;')(sessionStorage, window);
    run('test@example.com');
    expect(values.get('otp_email')).toBe('test@example.com');
    expect(values.has('otp_phone')).toBe(false);
    expect(values.has('otp_pending_password')).toBe(false);
    expect(values.has('otp_pending_name')).toBe(false);
    expect(values.get('auth_redirect')).toBe('/letterhead?document=test-new');
    expect(window.location.href).toBe('./verify-otp.html');
    expect(window.BondsAuth.getRedirectUrl).toHaveBeenCalledTimes(1);
    const login = html.slice(html.indexOf('window.sendMagicLink ='), html.indexOf('// Phone OTP'));
    expect((login.match(/continueEmailOtp\(email\);/g) || []).length).toBe(2);
  });
});
