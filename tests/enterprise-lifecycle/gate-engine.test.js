const { GateEngine } = require('../../lib/enterprise-lifecycle/gate-engine');

describe('GateEngine', () => {
  const engine = new GateEngine();

  test('data_completeness passes when threshold met', () => {
    const result = engine.evaluate({
      id: 'g1',
      type: 'data_completeness',
      threshold: 50,
      requiredFields: ['a', 'b']
    }, { a: 1, b: 2 });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  test('data_completeness fails when threshold not met', () => {
    const result = engine.evaluate({
      id: 'g2',
      type: 'data_completeness',
      threshold: 100,
      requiredFields: ['a', 'b']
    }, { a: 1 });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(50);
  });

  test('confidence_threshold passes when value high enough', () => {
    const result = engine.evaluate({
      id: 'g3',
      type: 'confidence_threshold',
      threshold: 70,
      contextPath: 'readiness.score'
    }, { readiness: { score: 75 } });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(75);
  });

  test('document_status passes for allowed status', () => {
    const result = engine.evaluate({
      id: 'g4',
      type: 'document_status',
      documentType: 'memo',
      allowedStatuses: ['approved']
    }, { documents: { memo: { status: 'approved' } } });
    expect(result.passed).toBe(true);
  });

  test('evaluateAll returns aggregate result', () => {
    const result = engine.evaluateAll([
      { id: 'g1', type: 'data_completeness', threshold: 50, requiredFields: ['a'] },
      { id: 'g3', type: 'confidence_threshold', threshold: 60, contextPath: 's' }
    ], { a: 1, s: 80 });
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(90);
  });

  test('data_completeness normalizes fractional thresholds to percentage', () => {
    const result = engine.evaluate({
      id: 'g5',
      type: 'data_completeness',
      threshold: 0.6,
      requiredFields: ['a', 'b', 'c', 'd']
    }, { a: 1 });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(25);
    expect(result.threshold).toBe(60);
  });

  test('data_completeness passes fractional threshold when truly met', () => {
    const result = engine.evaluate({
      id: 'g6',
      type: 'data_completeness',
      threshold: 0.5,
      requiredFields: ['a', 'b']
    }, { a: 1, b: 2 });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.threshold).toBe(50);
  });

  test('task_completion gate passes when all required tasks completed', () => {
    const result = engine.evaluate({
      id: 'g7',
      type: 'task_completion',
      taskCodes: ['submit_financials', 'upload_team'],
      required: 'all'
    }, {
      tasks: [
        { task_code: 'submit_financials', status: 'completed', stage_id: 'idea' },
        { task_code: 'upload_team', status: 'completed', stage_id: 'idea' }
      ]
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  test('task_completion gate fails when required task pending', () => {
    const result = engine.evaluate({
      id: 'g8',
      type: 'task_completion',
      taskCodes: ['submit_financials', 'upload_team'],
      required: 'all'
    }, {
      tasks: [
        { task_code: 'submit_financials', status: 'completed', stage_id: 'idea' },
        { task_code: 'upload_team', status: 'pending', stage_id: 'idea' }
      ]
    });
    expect(result.passed).toBe(false);
  });
});
