/**
 * BONDS Enterprise Intelligence Registry
 *
 * Catalog of all intelligence engines (wrapped standalone engines + new
 * meta-engines).  Provides intent-to-engine resolution and engine metadata.
 */

const DEFAULT_INTENT_ENGINES = {
  value_asset: [
    'live_market', 'sector_digital_twin', 'valuation', 'risk', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  buy_asset: [
    'live_market', 'sector_digital_twin', 'valuation', 'risk', 'financing', 'simulation', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  sell_asset: [
    'live_market', 'sector_digital_twin', 'valuation', 'market', 'risk', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  revalue: [
    'live_market', 'sector_digital_twin', 'valuation', 'risk', 'market', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  feasibility: [
    'live_market', 'sector_digital_twin', 'valuation', 'risk', 'feasibility', 'scenario', 'simulation', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  investment: [
    'live_market', 'sector_digital_twin', 'valuation', 'risk', 'feasibility', 'scenario',
    'simulation', 'market', 'recommendation', 'blind_spot', 'decision_graph',
    'recommendation_synthesizer', 'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  expansion: [
    'live_market', 'sector_digital_twin', 'market', 'opportunity', 'feasibility', 'scenario',
    'simulation', 'risk', 'recommendation', 'blind_spot', 'decision_graph',
    'recommendation_synthesizer', 'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  request_financing: [
    'live_market', 'sector_digital_twin', 'risk', 'financing', 'valuation', 'simulation',
    'recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  market_analysis: [
    'live_market', 'sector_digital_twin', 'market', 'opportunity', 'recommendation',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ],
  risk_analysis: [
    'live_market', 'sector_digital_twin', 'risk', 'simulation', 'blind_spot',
    'decision_graph', 'recommendation_synthesizer', 'decision_recommendation',
    'evidence_graph', 'decision_memory'
  ],
  compare_scenarios: [
    'sector_digital_twin', 'scenario', 'simulation', 'valuation', 'risk',
    'blind_spot', 'decision_graph', 'recommendation_synthesizer',
    'decision_recommendation', 'evidence_graph', 'decision_memory'
  ]
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
      return [
        'blind_spot',
        'decision_graph',
        'recommendation_synthesizer',
        'decision_recommendation',
        'evidence_graph',
        'decision_memory'
      ];
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
