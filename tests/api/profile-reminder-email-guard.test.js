const { isReservedTestEmail } = require('../../api/admin.js');

describe('profile reminder reserved test email guard', () => {
  test.each([
    'user@example.com',
    'user@example.net',
    'user@example.org',
    'user@test.invalid',
    'user@bonds-test.local',
    'user@localhost'
  ])('skips reserved non-deliverable address %s', (email) => {
    expect(isReservedTestEmail(email)).toBe(true);
  });

  test.each([
    'user@bonds-global.com',
    'user@gmail.com',
    'user@hotmail.com'
  ])('allows normal deliverable address %s', (email) => {
    expect(isReservedTestEmail(email)).toBe(false);
  });
});
