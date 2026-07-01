const { UcpAssetModel, UcpAsset, UniversalAssetModelRegistry } = require('../../lib/ucp/universal-asset-model');

describe('Universal Asset Model', () => {
  test('registers default asset models', () => {
    const registry = new UniversalAssetModelRegistry({ preferStatic: true });
    expect(registry.get('uam_real_estate')).toBeDefined();
    expect(registry.findByClass('vehicle').length).toBe(1);
  });

  test('validates required attributes', () => {
    const model = new UcpAssetModel({
      code: 'test_model',
      name: 'Test',
      asset_class: 'test',
      schema: { identity: ['name'], financial: ['value'] }
    });
    const pass = model.validateAttributes({ name: 'X', status: 'active' });
    expect(pass.valid).toBe(true);
    const fail = model.validateAttributes({ value: 100 });
    expect(fail.valid).toBe(false);
  });

  test('asset get/set nested fields', () => {
    const model = new UcpAssetModel({ code: 'm', name: 'M', asset_class: 'x', schema: {} });
    const asset = new UcpAsset({ model, identifier: 'A-1', attributes: { financial: { revenue: 100 } } });
    expect(asset.get('financial.revenue')).toBe(100);
    asset.set('financial.cost', 60);
    expect(asset.get('financial.cost')).toBe(60);
  });
});
