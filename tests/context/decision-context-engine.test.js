const { detectContext, applyContext, getContext } = require('../../lib/context/decision-context-engine');
const semantic = require('../../lib/semantic');

describe('Decision Context Engine', () => {
  it('detects financing context', () => {
    const ctx = detectContext('طلب تمويل');
    expect(ctx.context).toBe('financing');
    expect(ctx.confidence).toBeGreaterThan(0);
  });

  it('detects investment context in English', () => {
    const ctx = detectContext('investment opportunity');
    expect(ctx.context).toBe('investment');
  });

  it('infers context from intent', () => {
    const ctx = detectContext('', { intent: 'request_financing' });
    expect(ctx.context).toBe('financing');
  });

  it('applies context to profile fields', () => {
    const profile = semantic.getProfile('company');
    const ctx = detectContext('investment');
    const applied = applyContext(profile, ctx);
    const revenueField = applied.defaultFields.find(f => f.name === 'annual_revenue');
    expect(revenueField.weight).toBeGreaterThan(1);
    expect(applied.requiredEngines).toContain('simulation');
  });

  it('returns null for unknown context', () => {
    expect(detectContext('')).toBeNull();
  });

  it('gets context by id', () => {
    expect(getContext('purchase').id).toBe('purchase');
  });
});
