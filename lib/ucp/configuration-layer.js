/**
 * BONDS UCP Configuration Layer
 *
 * Loads configuration overrides for sector, country, policy, formula, etc.
 * without code changes.
 */

const DEFAULT_CONFIG = [
  { context_key: 'country', context_value: 'SA', config_type: 'policy', config_code: 'vat_rate', value: 15 },
  { context_key: 'country', context_value: 'AE', config_type: 'policy', config_code: 'vat_rate', value: 5 },
  { context_key: 'sector', context_value: 'restaurant', config_type: 'formula', config_code: 'benchmark_food_cost_pct', value: 30 },
  { context_key: 'sector', context_value: 'retail', config_type: 'formula', config_code: 'benchmark_gross_margin', value: 25 }
];

class ConfigurationLayer {
  constructor({ configs = [], preferStatic = false } = {}) {
    this.configs = [];
    if (preferStatic || configs.length === 0) {
      for (const c of DEFAULT_CONFIG) this.add(c);
    }
    for (const c of configs) this.add(c);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_configurations').select('*');
    if (error) throw error;
    return new ConfigurationLayer({ configs: data || [] });
  }

  add(config) {
    this.configs.push(config);
  }

  /**
   * Resolve config value by context hierarchy:
   * exact (country+sector) > country > sector > global.
   */
  resolve(configType, configCode, context = {}) {
    const candidates = this.configs.filter(c =>
      c.config_type === configType &&
      c.config_code === configCode &&
      isActiveConfig(c)
    );

    const scored = candidates.map(c => {
      let score = 0;
      if (c.context_key === 'country' && c.context_value === context.country) score += 100;
      if (c.context_key === 'sector' && c.context_value === context.sector) score += 100;
      if (c.context_key === 'global') score += 10;
      score += (c.priority || 0);
      return { config: c, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.config || null;
  }

  getValue(configType, configCode, context = {}, defaultValue) {
    const cfg = this.resolve(configType, configCode, context);
    return cfg ? cfg.value : defaultValue;
  }
}

function isActiveConfig(config, asOf = new Date()) {
  const date = asOf instanceof Date ? asOf : new Date(asOf);
  if (config.status && config.status !== 'active') return false;
  if (config.effective_from && new Date(config.effective_from) > date) return false;
  if (config.effective_to && new Date(config.effective_to) < date) return false;
  return true;
}

module.exports = { ConfigurationLayer, DEFAULT_CONFIG };
