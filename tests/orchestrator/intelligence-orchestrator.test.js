const { run } = require('../../lib/orchestrator/intelligence-orchestrator');

describe('Intelligence Orchestrator', () => {
  it('runs a full restaurant feasibility request', async () => {
    const { result, trace } = await run({
      input: 'دراسة جدوى لمطعم في الرياض',
      sector: 'restaurant',
      activity: 'fast food',
      context: 'investment',
      userTier: 'pro',
      language: 'ar',
      country: 'SA',
      city: 'Riyadh'
    });

    expect(result.intent.intent).toBe('feasibility');
    expect(result.sector.sector).toBe('restaurant');
    expect(result.form.fields.length).toBeGreaterThan(0);
    expect(result.autoPopulate).toBeDefined();
    expect(result.confidence.score).toBeGreaterThan(0);
    expect(result.explanation.language).toBe('ar');
    expect(trace.name).toBe('intelligence-orchestrator');
  });

  it('runs a financing request', async () => {
    const { result } = await run({
      input: 'I need financing for my factory',
      sector: 'manufacturing',
      context: 'financing',
      language: 'en',
      userTier: 'enterprise'
    });
    expect(result.intent.intent).toBe('request_financing');
    expect(result.context.context).toBe('financing');
  });

  it('throws for unknown sector', async () => {
    await expect(run({
      input: 'value my spaceship',
      sector: 'spaceship'
    })).rejects.toThrow('Unknown sector');
  });

  it('includes engine results', async () => {
    const { result } = await run({
      input: 'value my hotel',
      sector: 'hotel',
      context: 'purchase',
      language: 'en'
    });
    expect(Object.keys(result.engineResults).length).toBeGreaterThan(0);
  });
});
