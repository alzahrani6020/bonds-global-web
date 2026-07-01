/**
 * @jest-environment node
 */

const { EnterpriseIntelligenceRegistry, DEFAULT_INTENT_ENGINES } = require('../../lib/enterprise-intelligence/registry');

describe('EnterpriseIntelligenceRegistry', () => {
  test('registers and retrieves an engine', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('demo', () => ({ ok: true }), { name: 'Demo Engine' });
    expect(registry.has('demo')).toBe(true);
    expect(registry.getMetadata('demo').name).toBe('Demo Engine');
  });

  test('lists registered engines', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('a', () => ({}), { name: 'A' });
    registry.register('b', () => ({}), { name: 'B' });
    const list = registry.listEngines();
    expect(list).toHaveLength(2);
    expect(list.map(e => e.code)).toEqual(['a', 'b']);
  });

  test('resolves explicit engines', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('x', () => ({}));
    registry.register('y', () => ({}));
    expect(registry.resolveEngines({ engines: ['x', 'y'] })).toEqual(['x', 'y']);
  });

  test('rejects unknown explicit engines', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    expect(() => registry.resolveEngines({ engines: ['unknown'] })).toThrow('Unknown engine');
  });

  test('resolves engines by intent', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('valuation', () => ({}));
    registry.register('risk', () => ({}));
    DEFAULT_INTENT_ENGINES.risk_analysis.forEach(code => registry.register(code, () => ({})));
    expect(registry.resolveEngines({ intent: 'risk_analysis' })).toEqual(DEFAULT_INTENT_ENGINES.risk_analysis);
  });

  test('falls back to meta engines when intent is missing', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('blind_spot', () => ({}));
    registry.register('decision_graph', () => ({}));
    registry.register('recommendation_synthesizer', () => ({}));
    expect(registry.resolveEngines({})).toEqual(['blind_spot', 'decision_graph', 'recommendation_synthesizer']);
  });

  test('factory creates instance', () => {
    const registry = new EnterpriseIntelligenceRegistry();
    registry.register('factory_demo', (ctx) => ({ ctx }));
    const instance = registry.createInstance('factory_demo', { hello: 'world' });
    expect(instance.ctx.hello).toBe('world');
  });
});
