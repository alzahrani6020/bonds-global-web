const { explain, explainDecision } = require('../../lib/explainability/explainability-engine');

describe('Explainability Engine', () => {
  it('explains a result in Arabic', () => {
    const result = explain({
      value: 1500000,
      confidence: 82,
      reason: 'القيمة محسوبة من البيانات السوقية.',
      inputs: [{ name: 'market_value', value: 1500000, source: 'market' }],
      evidence: [{ source: 'market_rent', value: 22000, confidence: 75 }]
    }, { language: 'ar', currency: 'SAR' });

    expect(result.language).toBe('ar');
    expect(result.why).toContain('البيانات السوقية');
    expect(result.evidence).toHaveLength(1);
  });

  it('explains a result in English', () => {
    const result = explain({
      value: 500000,
      confidence: 70,
      inputs: [{ name: 'revenue', value: 1000000 }]
    }, { language: 'en', currency: 'USD' });

    expect(result.language).toBe('en');
    expect(result.basedOn).toHaveLength(1);
  });

  it('explains a decision', () => {
    const exp = explainDecision('financing', { language: 'ar' }, { value: 'warning' });
    expect(exp.why).toContain('DSCR');
  });
});
