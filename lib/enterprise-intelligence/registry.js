/**
 * BONDS Enterprise Intelligence Registry
 *
 * Catalog of all intelligence engines (wrapped standalone engines + new
 * meta-engines).  Provides intent-to-engine resolution and engine metadata.
 */

const DEFAULT_INTENT_ENGINES = {
  value_asset: ['valuation', 'risk', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  buy_asset: ['valuation', 'risk', 'financing', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  sell_asset: ['valuation', 'market', 'risk', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  revalue: ['valuation', 'risk', 'market', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  feasibility: ['valuation', 'risk', 'feasibility', 'scenario', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  investment: ['valuation', 'risk', 'feasibility', 'scenario', 'market', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  expansion: ['market', 'opportunity', 'feasibility', 'scenario', 'risk', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  request_financing: ['risk', 'financing', 'valuation', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  market_analysis: ['market', 'opportunity', 'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  risk_analysis: ['risk', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
  compare_scenarios: ['scenario', 'valuation', 'risk', 'blind_spot', 'decision_graph', 'recommendation_synthesizer']
};

class EnterpriseIntelligenceRegistry {
  constructor() {
    this.engines = new Map();
  }

  register(code, factory, metadata = {}) {
    if (!code || typeof code !== 'string') {
      throw new Error('Engine code is required');
    }
    this.engines.set(code, {
      code,
      factory,
      metadata: {
        name: metadata.name || code,
        description: metadata.description || '',
        category: metadata.category || 'analysis',
        requiresUcp: metadata.requiresUcp || false,
        requiresFabric: metadata.requiresFabric || false,
        isPostProcessor: metadata.isPostProcessor || false,
        confidenceWeight: metadata.confidenceWeight || 1,
        inputs: metadata.inputs || [],
        outputs: metadata.outputs || [],
        ...metadata
      }
    });
    return this;
  }

  get(code) {
    return this.engines.get(code);
  }

  has(code) {
    return this.engines.has(code);
  }

  listEngines() {
    return Array.from(this.engines.values()).map(e => ({
      code: e.code,
      ...e.metadata
    }));
  }

  resolveEngines(request) {
    const explicit = request.engines || request.requiredEngines;
    if (Array.isArray(explicit) && explicit.length) {
      const unknown = explicit.filter(code => !this.engines.has(code));
      if (unknown.length) {
        throw new Error(`Unknown engine(s): ${unknown.join(', ')}`);
      }
      return explicit;
    }

    const intent = request.intent;
    if (!intent || !DEFAULT_INTENT_ENGINES[intent]) {
      return ['blind_spot', 'decision_graph', 'recommendation_synthesizer'];
    }

    return DEFAULT_INTENT_ENGINES[intent];
  }

  createInstance(code, context) {
    const entry = this.engines.get(code);
    if (!entry) throw new Error(`Engine not found: ${code}`);
    return entry.factory(context);
  }

  getMetadata(code) {
    return this.engines.get(code)?.metadata || null;
  }
}

module.exports = { EnterpriseIntelligenceRegistry, DEFAULT_INTENT_ENGINES };
