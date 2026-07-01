const { LearningLoop } = require('../../lib/learning/learning-loop');

describe('Learning Loop', () => {
  it('records a learning event in memory', async () => {
    const loop = new LearningLoop(null);
    const event = await loop.record({
      userId: 'u1',
      projectId: 'p1',
      eventType: 'recommendation',
      recommendationId: 'rec-1',
      action: 'accepted',
      confidenceBefore: 70,
      confidenceAfter: 85
    });
    expect(event.action).toBe('accepted');
  });

  it('computes preference weights', () => {
    const loop = new LearningLoop(null);
    const events = [
      { event_type: 'recommendation', action: 'accepted' },
      { event_type: 'recommendation', action: 'accepted' },
      { event_type: 'recommendation', action: 'rejected' },
      { event_type: 'report', action: 'modified' }
    ];
    const weights = loop.computePreferenceWeights(events);
    expect(weights.recommendation.acceptanceRate).toBe(2 / 3);
    expect(weights.report.modificationRate).toBe(1);
  });
});
