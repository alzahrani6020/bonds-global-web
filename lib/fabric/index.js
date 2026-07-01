/**
 * BONDS Trusted Data Fabric — Public API
 */

const BaseConnector = require('./connector');
const { ConnectorRegistry } = require('./connector-registry');
const { SourceRegistry } = require('./source-registry');
const { SourceRankingEngine } = require('./source-ranking-engine');
const { FreshnessEngine } = require('./freshness-engine');
const { DataQualityEngine } = require('./data-quality-engine');
const { ConsensusEngine } = require('./consensus-engine');
const { ConflictResolutionEngine } = require('./conflict-resolution-engine');
const { Provenance } = require('./provenance');
const { TrustedDataFabric } = require('./trusted-data-fabric');
const { Observability } = require('./observability');
const { Monitoring } = require('./monitoring');
const { SmartOverride } = require('./smart-override');
const { DecisionImpactEngine } = require('./decision-impact-engine');
const { MarketplaceFoundation } = require('./marketplace-foundation');
const { PluginSDK } = require('./plugin-sdk');
const { FabricSecurity } = require('./security');
const { ApiContractRegistry } = require('./api-contract');
const { DatabaseConnector } = require('./connectors/database-connector');
const { ManualConnector } = require('./connectors/manual-connector');

module.exports = {
  BaseConnector,
  ConnectorRegistry,
  SourceRegistry,
  SourceRankingEngine,
  FreshnessEngine,
  DataQualityEngine,
  ConsensusEngine,
  ConflictResolutionEngine,
  Provenance,
  TrustedDataFabric,
  Observability,
  Monitoring,
  SmartOverride,
  DecisionImpactEngine,
  MarketplaceFoundation,
  PluginSDK,
  FabricSecurity,
  ApiContractRegistry,
  DatabaseConnector,
  ManualConnector
};
