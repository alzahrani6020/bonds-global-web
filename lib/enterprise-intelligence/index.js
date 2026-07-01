/**
 * BONDS Enterprise Intelligence Layer — Public API
 *
 * Wave 4.3: a unified registry + runner that wraps all BONDS engines and
 * feeds them through the Trusted Data Fabric while keeping UCP as the
 * single source of financial calculation truth.
 */

const { EnterpriseIntelligenceRegistry, DEFAULT_INTENT_ENGINES } = require('./registry');
const { run, createDefaultRegistry, createFabric, normalizeEvidence, aggregateConfidence } = require('./runner');
const { adapt, adapters, loadValuationEngine } = require('./engine-adapter');
const { BlindSpotEngine } = require('./blind-spot-engine');
const { DecisionGraphEngine } = require('./decision-graph-engine');
const { RecommendationSynthesizer } = require('./recommendation-synthesizer');

module.exports = {
  EnterpriseIntelligenceRegistry,
  DEFAULT_INTENT_ENGINES,
  run,
  createDefaultRegistry,
  createFabric,
  normalizeEvidence,
  aggregateConfidence,
  adapt,
  adapters,
  loadValuationEngine,
  BlindSpotEngine,
  DecisionGraphEngine,
  RecommendationSynthesizer
};
