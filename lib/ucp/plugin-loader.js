/**
 * BONDS UCP Plugin Loader
 *
 * Allows future extension of sectors, countries, valuation methods, financing
 * models, reports and certificates without modifying Core Platform.
 */

class PluginLoader {
  constructor({ plugins = [], preferStatic = false } = {}) {
    this.plugins = new Map();
    const builtins = [
      { code: 'plugin_valuation_income', name: 'Income Valuation Method', plugin_type: 'valuation', entry_point: 'income' },
      { code: 'plugin_valuation_market', name: 'Market Valuation Method', plugin_type: 'valuation', entry_point: 'market' },
      { code: 'plugin_report_pdf', name: 'PDF Report Generator', plugin_type: 'report', entry_point: 'pdf' },
      { code: 'plugin_certificate_bdvc', name: 'BDVC Certificate', plugin_type: 'certificate', entry_point: 'bdvc' }
    ];
    if (preferStatic || plugins.length === 0) {
      for (const p of builtins) this.register(p);
    }
    for (const p of plugins) this.register(p);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_plugins').select('*');
    if (error) throw error;
    return new PluginLoader({ plugins: data || [] });
  }

  register(plugin) {
    if (!plugin || !plugin.code) throw new Error('Plugin must have code');
    this.plugins.set(plugin.code, plugin);
  }

  get(code) { return this.plugins.get(code); }
  list() { return Array.from(this.plugins.values()); }
  byType(type) { return this.list().filter(p => p.plugin_type === type); }

  /**
   * Future hook: execute plugin if an entry_point function is registered.
   * Currently returns metadata; concrete execution is loaded by path if available.
   */
  async execute(code, context = {}) {
    const plugin = this.get(code);
    if (!plugin) throw new Error(`Plugin not found: ${code}`);
    if (plugin.entry_point && typeof plugin.entry_point === 'function') {
      return plugin.entry_point(context);
    }
    return { plugin: plugin.code, status: 'registered', context };
  }
}

module.exports = { PluginLoader };
