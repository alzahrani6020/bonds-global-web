const { detectIntent, getIntent, listIntents } = require('../../lib/intent/intent-engine');

describe('Intent Engine', () => {
  it('detects financing intent in Arabic', () => {
    const result = detectIntent('أحتاج تمويل للمشروع');
    expect(result.intent).toBe('request_financing');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects feasibility intent', () => {
    const result = detectIntent('عمل دراسة جدوى لمطعم');
    expect(result.intent).toBe('feasibility');
  });

  it('detects valuation intent in English', () => {
    const result = detectIntent('I want to value my hotel');
    expect(result.intent).toBe('value_asset');
  });

  it('detects certificate intent', () => {
    const result = detectIntent('أريد شهادة رقمية');
    expect(result.intent).toBe('issue_certificate');
  });

  it('falls back to feasibility for project context', () => {
    const result = detectIntent('', { sector: 'restaurant', project_type: 'new' });
    expect(result.intent).toBe('feasibility');
  });

  it('returns null for empty input without context', () => {
    expect(detectIntent('')).toBeNull();
  });

  it('lists all intents', () => {
    const intents = listIntents();
    expect(intents.length).toBeGreaterThan(10);
  });

  it('gets a single intent', () => {
    expect(getIntent('buy_asset').id).toBe('buy_asset');
  });
});
