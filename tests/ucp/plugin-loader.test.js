const { PluginLoader } = require('../../lib/ucp/plugin-loader');

describe('UCP Plugin Loader', () => {
  let loader;

  beforeEach(() => {
    loader = new PluginLoader({ preferStatic: true });
  });

  test('loads built-in plugins', () => {
    expect(loader.byType('valuation').length).toBe(2);
    expect(loader.get('plugin_certificate_bdvc')).toBeDefined();
  });

  test('returns registered status for plugin without function', async () => {
    const result = await loader.execute('plugin_report_pdf');
    expect(result.status).toBe('registered');
  });
});
