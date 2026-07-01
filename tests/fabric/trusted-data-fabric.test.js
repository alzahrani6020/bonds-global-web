const {
  BaseConnector,
  ConnectorRegistry,
  TrustedDataFabric,
  SourceRankingEngine,
  FreshnessEngine,
  DataQualityEngine,
  ConsensusEngine,
  ConflictResolutionEngine,
  Provenance,
  PluginSDK,
  FabricSecurity,
  MarketplaceFoundation
} = require('../../lib/fabric');

class TestConnector extends BaseConnector {
  constructor(sourceCode, values) {
    super({ sourceCode, sourceName: sourceCode, category: 'test' });
    this.values = values;
  }
  async fetch(request) {
    return this.values.map(v => ({ ...v, sourceId: this.sourceCode, sourceCode: this.sourceCode }));
  }
  async normalize(raw) {
    return raw.map(r => ({ metricCode: r.metricCode, value: r.value, confidence: r.confidence, collectedAt: r.collectedAt }));
  }
  async validate(n) {
    return { valid: n.value !== undefined && n.value !== null, errors: [] };
  }
}

describe('Fabric engines', () => {
  test('SourceRankingEngine computes overall score', () => {
    const engine = new SourceRankingEngine();
    const source = {
      id: 'src-1',
      source_code: 'test',
      status: 'active',
      trust_anchor: 'official',
      supported_countries: ['SA', 'AE'],
      supported_industries: ['retail'],
      last_run_at: new Date().toISOString()
    };
    const rank = engine.rank(source, { accuracy: 90 });
    expect(rank.overallScore).toBeGreaterThan(0);
    expect(rank.overallScore).toBeLessThanOrEqual(100);
    expect(rank.scores.trust).toBe(95);
  });

  test('FreshnessEngine evaluates age', () => {
    const engine = new FreshnessEngine();
    const fresh = engine.evaluate({ collectedAt: new Date().toISOString() }, { maxAgeSeconds: 3600 });
    expect(fresh.freshnessScore).toBe(100);
    expect(fresh.recommendation).toBe('fresh');

    const stale = engine.evaluate({ collectedAt: '2020-01-01T00:00:00Z' }, { maxAgeSeconds: 3600 });
    expect(stale.freshnessScore).toBe(0);
    expect(stale.recommendation).toBe('expired');
  });

  test('DataQualityEngine computes dimensions', () => {
    const engine = new DataQualityEngine();
    const q = engine.evaluate(42, { accuracyScore: 90, requiredFields: ['value'] });
    expect(q.overallScore).toBeGreaterThan(0);
    expect(q.dimensions.validity).toBe(80);
  });

  test('ConsensusEngine merges numeric sources', () => {
    const engine = new ConsensusEngine();
    const result = engine.merge([
      { sourceId: 'a', value: 100, confidence: 80 },
      { sourceId: 'b', value: 102, confidence: 80 }
    ], 'number');
    expect(result.value).toBe(101);
    expect(result.method).toBe('weighted_consensus');
    expect(result.alternatives.length).toBe(0);
  });

  test('ConsensusEngine flags outlier', () => {
    const engine = new ConsensusEngine({ outlierThreshold: 1.0 });
    const result = engine.merge([
      { sourceId: 'a', value: 100, confidence: 80 },
      { sourceId: 'b', value: 100, confidence: 80 },
      { sourceId: 'c', value: 300, confidence: 80 }
    ], 'number');
    expect(result.alternatives.length).toBe(1);
  });

  test('ConflictResolutionEngine picks highest confidence', () => {
    const engine = new ConflictResolutionEngine();
    const resolution = engine.resolve([
      { sourceId: 'a', sourceCode: 'A', value: 100, confidence: 80 },
      { sourceId: 'b', sourceCode: 'B', value: 110, confidence: 90 }
    ]);
    expect(resolution.selectedSourceId).toBe('b');
    expect(resolution.selectedValue).toBe(110);
  });

  test('Provenance builds lineage record', () => {
    const record = Provenance.build({
      entityType: 'form_field',
      entityId: 'proj-1',
      field: 'rent',
      value: 22000,
      sourceId: 'src-1',
      confidence: 85,
      reason: 'imported from official source'
    });
    expect(record.entityType).toBe('form_field');
    expect(record.evidence.reason).toBe('imported from official source');
  });

  test('PluginSDK validates manifest', () => {
    const valid = PluginSDK.validateManifest({
      pluginCode: 'x',
      name: 'X',
      version: '1.0.0',
      permissions: [],
      dependencies: [],
      supportedVersions: ['1.x']
    });
    expect(valid.valid).toBe(true);

    const invalid = PluginSDK.validateManifest({});
    expect(invalid.valid).toBe(false);
  });

  test('FabricSecurity reads env secret', async () => {
    process.env.TEST_CONNECTOR_KEY = 'secret';
    const sec = new FabricSecurity();
    const secret = await sec.getSecret('test-connector', 'key');
    expect(secret.value).toBe('secret');
    delete process.env.TEST_CONNECTOR_KEY;
  });
});

describe('TrustedDataFabric pipeline', () => {
  test('resolves a metric with provided records', async () => {
    const registry = new ConnectorRegistry();
    const fabric = new TrustedDataFabric({ connectorRegistry: registry, sourceRegistry: null });

    const result = await fabric.resolve({
      metricCode: 'rent',
      dataType: 'number',
      records: [
        { sourceId: 'a', sourceCode: 'A', value: 100, confidence: 80, collectedAt: new Date().toISOString() },
        { sourceId: 'b', sourceCode: 'B', value: 102, confidence: 80, collectedAt: new Date().toISOString() }
      ]
    });

    expect(result.value).toBe(101);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.provenance).toBeDefined();
  });

  test('resolveValues maps fields', async () => {
    const registry = new ConnectorRegistry();
    const fabric = new TrustedDataFabric({ connectorRegistry: registry, sourceRegistry: null });
    const values = await fabric.resolveValues({
      fields: [{ name: 'rent', type: 'number' }],
      context: { country: 'SA' }
    });
    expect(values.rent).toBeDefined();
    // No records provided, so estimated value should be null with low confidence.
    expect(values.rent.value).toBeNull();
  });
});

describe('ConnectorRegistry', () => {
  test('registers and fetches from a connector', async () => {
    const registry = new ConnectorRegistry();
    registry.register(new TestConnector('test', [{ metricCode: 'rent', value: 22000, confidence: 80 }]));
    const items = await registry.fetch('test', { metricCode: 'rent' });
    expect(items.length).toBe(1);
    expect(items[0].value).toBe(22000);
  });
});
