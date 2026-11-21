'use strict';

const semantic = require('../../lib/semantic');
const { buildForm } = require('../../lib/forms/dynamic-form-engine');
const { run } = require('../../lib/orchestrator/intelligence-orchestrator');

describe('trade sector used by feasibility workspace', () => {
  test('trade resolves to its canonical profile without conversion to retail', () => {
    const match = semantic.resolveSector('trade');
    expect(match).toBeTruthy();
    expect(match.sector).toBe('trade');
    expect(semantic.getProfile('trade').sector).toBe('trade');
    expect(semantic.resolveSector('تجارة الجملة').sector).toBe('trade');
    expect(semantic.resolveSector('retail').sector).toBe('retail');
  });

  test('trade form is constructible without assuming turnover or margins', () => {
    const form = buildForm({
      sector: 'trade',
      activity: 'wholesale office supplies',
      intent: 'feasibility',
      context: 'investment',
      language: 'ar'
    });
    expect(form.sector).toBe('trade');
    expect(form.fields.some(field => field.name === 'annual_revenue')).toBe(true);
    expect(form.fields.some(field => field.name === 'cost_of_goods_sold')).toBe(true);
    expect(form.fields.find(field => field.name === 'annual_revenue').default).toBeUndefined();
  });

  test('orchestrator accepts a trade feasibility request without treating missing finances as verified', async () => {
    const { result, trace } = await run({
      input: 'دراسة جدوى توريد المواد الاستهلاكية للمكاتب',
      sector: 'trade',
      activity: 'wholesale',
      context: 'investment',
      userTier: 'pro',
      language: 'ar',
      country: 'SA',
      city: 'Jeddah'
    });
    expect(result.sector.sector).toBe('trade');
    expect(result.form.sector).toBe('trade');
    expect(result.engineResults.feasibility).toBeDefined();
    expect(trace.name).toBe('intelligence-orchestrator');
  });

  test('unknown sector is still rejected', () => {
    expect(semantic.resolveSector('unrecognized-spaceship-sector')).toBeNull();
  });
});
