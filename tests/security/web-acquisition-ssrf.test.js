const {
  isForbiddenIp,
  validatePublicUrl,
  fetchUrl
} = require('../../lib/intelligence/web-acquisition');

describe('web acquisition SSRF boundary', () => {
  test.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '192.88.99.1',
    '198.18.0.1',
    '240.0.0.1',
    '::1',
    'fe80::1',
    'febf::1',
    'fc00::1',
    'fd00::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1'
  ])('blocks private/reserved address %s', address => {
    expect(isForbiddenIp(address)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '192.0.1.1', '2606:4700:4700::1111'])(
    'allows representative public address %s',
    address => {
      expect(isForbiddenIp(address)).toBe(false);
    }
  );

  test('rejects non-http schemes before network access', async () => {
    await expect(validatePublicUrl('file:///etc/passwd')).rejects.toMatchObject({
      code: 'UNSUPPORTED_SCHEME'
    });
  });

  test('rejects credentials embedded in URLs before network access', async () => {
    await expect(validatePublicUrl('https://user:pass@example.com/path')).rejects.toMatchObject({
      code: 'URL_CREDENTIALS_FORBIDDEN'
    });
  });

  test('blocks loopback literal without issuing a request', async () => {
    const result = await fetchUrl('http://127.0.0.1:3000/internal');
    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.evidence.failure_class).toBe('POLICY_BLOCK');
    expect(result.evidence.blocked_reason).toBe('PRIVATE_OR_RESERVED_DESTINATION');
  });
});
