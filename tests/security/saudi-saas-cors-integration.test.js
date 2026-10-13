const { getAllowedOrigin, ALLOWED_ORIGINS } = require('../../lib/api/cors');

describe('Saudi SaaS CORS integration', () => {
  test('allows the production Saudi SaaS console origins', () => {
    expect(ALLOWED_ORIGINS).toContain('https://saudi-saas.com');
    expect(ALLOWED_ORIGINS).toContain('https://www.saudi-saas.com');
    expect(getAllowedOrigin({ headers: { origin: 'https://saudi-saas.com' } }))
      .toBe('https://saudi-saas.com');
  });

  test('keeps unknown origins fail-closed to the canonical Bonds origin', () => {
    expect(getAllowedOrigin({ headers: { origin: 'https://example.invalid' } }))
      .toBe('https://bonds-global.com');
  });
});
