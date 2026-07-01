const { ConfigurationLayer } = require('../../lib/ucp/configuration-layer');

describe('UCP Configuration Layer', () => {
  let config;

  beforeEach(() => {
    config = new ConfigurationLayer({ preferStatic: true });
  });

  test('resolves country-specific VAT', () => {
    const sa = config.getValue('policy', 'vat_rate', { country: 'SA' });
    expect(sa).toBe(15);
    const ae = config.getValue('policy', 'vat_rate', { country: 'AE' });
    expect(ae).toBe(5);
  });

  test('returns default when no config', () => {
    const value = config.getValue('policy', 'unknown_key', {}, 'fallback');
    expect(value).toBe('fallback');
  });
});
