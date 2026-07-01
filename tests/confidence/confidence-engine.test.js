const {
  gradeConfidence,
  scoreToConfidence,
  combineConfidence,
  propagate,
  thresholdMet,
  explainConfidence
} = require('../../lib/confidence/confidence-engine');

describe('Confidence Engine', () => {
  it('grades scores correctly', () => {
    expect(gradeConfidence(90)).toBe('A');
    expect(gradeConfidence(75)).toBe('B');
    expect(gradeConfidence(60)).toBe('C');
    expect(gradeConfidence(40)).toBe('D');
    expect(gradeConfidence(10)).toBe('F');
  });

  it('computes source score', () => {
    expect(scoreToConfidence({ sourceGrade: 'A', freshnessDays: 3, validated: true })).toBeGreaterThan(90);
  });

  it('penalizes old data', () => {
    const fresh = scoreToConfidence({ sourceGrade: 'B', freshnessDays: 5 });
    const old = scoreToConfidence({ sourceGrade: 'B', freshnessDays: 120 });
    expect(fresh).toBeGreaterThan(old);
  });

  it('combines confidences', () => {
    const combined = combineConfidence([90, 80, 70]);
    expect(combined).toBeLessThan(90);
    expect(combined).toBeGreaterThan(70);
  });

  it('propagates with operation reliability', () => {
    const score = propagate([{ score: 80, weight: 1 }], 0.9);
    expect(score).toBe(72);
  });

  it('checks threshold', () => {
    expect(thresholdMet(85, 80)).toBe(true);
    expect(thresholdMet(75, 80)).toBe(false);
  });

  it('explains confidence', () => {
    const exp = explainConfidence(65, [{ name: 'market_data', score: 70, weight: 1 }]);
    expect(exp.grade).toBe('C');
    expect(exp.inputs).toHaveLength(1);
  });
});
