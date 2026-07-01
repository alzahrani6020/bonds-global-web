const { TemplateEngine } = require('../../lib/ucp/template-engine');

describe('UCP Template Engine', () => {
  let engine;

  beforeEach(() => {
    engine = new TemplateEngine({ preferStatic: true });
  });

  test('resolves restaurant template', () => {
    const template = engine.resolve('restaurant');
    expect(template).toBeDefined();
    expect(template.sector).toBe('restaurant');
  });

  test('builds fields from template', () => {
    const template = engine.resolve('company');
    const fields = engine.buildFields(template);
    expect(fields.inputs.length).toBeGreaterThan(0);
    expect(fields.outputs.length).toBeGreaterThan(0);
  });

  test('prefers country-specific template', () => {
    engine.register({ code: 'tmp_retail_sa', name: 'Retail SA', sector: 'retail', country: 'SA', version: 1, schema: { inputs: [], outputs: [] } });
    const template = engine.resolve('retail', 'SA');
    expect(template.country).toBe('SA');
  });
});
