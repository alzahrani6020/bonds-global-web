/**
 * @jest-environment node
 */
const {
  isStudiesService,
  studiesBindingFor,
  studiesGeoFrom,
  studiesResearchPacket,
  enrichStudiesExecutionRequest
} = require('../../lib/services/studies-workspace-bindings');

describe('studies workspace field bindings', () => {
  test('scientific research maps to research engines and capabilities', () => {
    expect(isStudiesService('scientific_research')).toBe(true);
    const spec = studiesBindingFor('scientific_research');
    expect(spec.intent).toBe('scientific_research');
    expect(spec.engines).toEqual(expect.arrayContaining(['knowledge', 'evidence']));
    expect(spec.capabilities).toEqual(expect.arrayContaining([
      'orchestrator_run',
      'market_intelligence',
      'research_intelligence_verify'
    ]));
  });

  test('form fields become geo, research query and execution overlay', () => {
    const values = {
      country_code: 'SA',
      locality_name: 'الرياض',
      sector_code: 'food_beverage',
      research_problem: 'هل كثافة المنافسة تخفض استمرار المطاعم؟',
      research_title: 'استدامة المطاعم',
      methodology: 'mixed'
    };
    const geo = studiesGeoFrom({ ...values, region_name: 'الرياض' }, { country: 'EG' });
    expect(geo).toMatchObject({ country: 'SA', region: 'الرياض', city: 'الرياض', sector: 'food_beverage' });
    const packet = studiesResearchPacket('scientific_research', values, geo);
    expect(packet.enabled).toBe(true);
    expect(packet.query).toContain('كثافة المنافسة');
    expect(packet.query).toContain('SA');
    expect(packet.methodology).toBe('mixed');

    const enriched = enrichStudiesExecutionRequest(
      { code: 'scientific_research', name_ar: 'البحث العلمي' },
      { orchestrator_intent: 'scientific_research' },
      { values, country_code: 'SA' },
      { input: 'البحث العلمي', values, sector: 'company' }
    );
    expect(enriched.input).toContain('كثافة المنافسة');
    expect(enriched.city).toBe('الرياض');
    expect(enriched.forceResearch).toBe(true);
    expect(enriched.research.query).toBe(packet.query);
  });

  test('non-studies services stay untouched', () => {
    const request = { input: 'keep', values: { a: 1 } };
    expect(enrichStudiesExecutionRequest(
      { code: 'income_statement' },
      {},
      {},
      request
    )).toBe(request);
  });
});
