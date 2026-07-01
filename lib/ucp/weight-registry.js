/**
 * BONDS UCP Weight Registry
 *
 * Loads configurable weights per context and computes weighted scores.
 */

const DEFAULT_WEIGHTS = [
  { code: 'wgt_financing', name: 'Financing Weights', context_key: 'intent', context_value: 'request_financing', weights: { dscr: 0.4, ltv: 0.3, roi: 0.2, payback_period: 0.1 } },
  { code: 'wgt_investment', name: 'Investment Weights', context_key: 'intent', context_value: 'feasibility', weights: { roi: 0.35, payback_period: 0.25, net_profit_margin: 0.25, dscr: 0.15 } },
  { code: 'wgt_buy', name: 'Buy Asset Weights', context_key: 'intent', context_value: 'buy_asset', weights: { asset_value: 0.4, ltv: 0.3, roi: 0.2, dscr: 0.1 } }
];

class WeightRegistry {
  constructor({ weights = [], preferStatic = false } = {}) {
    this.weights = new Map();
    if (preferStatic || weights.length === 0) {
      for (const w of DEFAULT_WEIGHTS) this.register(w);
    }
    for (const w of weights) this.register(w);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_weight_registry').select('*');
    if (error) throw error;
    return new WeightRegistry({ weights: data || [] });
  }

  register(weight) {
    if (!weight || !weight.code) throw new Error('Weight must have code');
    this.weights.set(weight.code, weight);
  }

  get(code) { return this.weights.get(code); }
  list() { return Array.from(this.weights.values()); }

  findByContext(contextKey, contextValue) {
    return this.list().filter(w => w.context_key === contextKey && (w.context_value === contextValue || !w.context_value));
  }

  findBySectorCountry(sector, country) {
    return this.list().filter(w => {
      if (w.sector && w.sector !== sector) return false;
      if (w.country && w.country !== country) return false;
      return true;
    });
  }

  /**
   * Compute weighted score using selected weight set and values map.
   * Missing values are treated as 0.
   */
  score(code, values) {
    const wset = this.get(code);
    if (!wset) throw new Error(`Weight set not found: ${code}`);
    const weights = wset.weights || {};
    let total = 0;
    let weightSum = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const value = Number(values[key]) || 0;
      total += value * weight;
      weightSum += weight;
    }
    return { score: weightSum ? total / weightSum : 0, weightedSum: total, weightSum, weights };
  }

  /**
   * Merge weights by context. Later codes override earlier.
   */
  mergeWeights(codes) {
    const merged = {};
    for (const code of codes) {
      const wset = this.get(code);
      if (!wset) continue;
      Object.assign(merged, wset.weights || {});
    }
    return merged;
  }
}

module.exports = { WeightRegistry, DEFAULT_WEIGHTS };
