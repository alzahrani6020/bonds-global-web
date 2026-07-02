const { evaluateExpression, tokenize, Parser } = require('../../lib/enterprise-lifecycle/expression-evaluator');

describe('Expression Evaluator', () => {
  const context = {
    readiness: { score: 75, grade: 'B' },
    valuation: { confidence: 82, value: 1000000 },
    documents: { memo: { status: 'approved' } },
    tags: ['financials', 'team'],
    name: 'Bonds Tower'
  };

  test('evaluates comparisons', () => {
    expect(evaluateExpression('readiness.score >= 70', context)).toBe(true);
    expect(evaluateExpression('readiness.score < 70', context)).toBe(false);
    expect(evaluateExpression('readiness.score == 75', context)).toBe(true);
    expect(evaluateExpression('readiness.score != 75', context)).toBe(false);
  });

  test('evaluates logical operators', () => {
    expect(evaluateExpression('readiness.score >= 70 && valuation.confidence >= 80', context)).toBe(true);
    expect(evaluateExpression('readiness.score >= 70 && valuation.confidence < 80', context)).toBe(false);
    expect(evaluateExpression('readiness.score < 70 || valuation.confidence >= 80', context)).toBe(true);
    expect(evaluateExpression('!(readiness.score < 70)', context)).toBe(true);
  });

  test('evaluates arithmetic', () => {
    expect(evaluateExpression('valuation.value / 1000000', context)).toBe(1);
    expect(evaluateExpression('readiness.score + 10', context)).toBe(85);
    expect(evaluateExpression('(2 + 3) * 4', context)).toBe(20);
  });

  test('evaluates string comparisons', () => {
    expect(evaluateExpression('documents.memo.status == "approved"', context)).toBe(true);
    expect(evaluateExpression('documents.memo.status != "draft"', context)).toBe(true);
  });

  test('evaluates helper functions', () => {
    expect(evaluateExpression('present(readiness.score)', context)).toBe(true);
    expect(evaluateExpression('empty(missing.field)', context)).toBe(true);
    expect(evaluateExpression('len(tags)', context)).toBe(2);
    expect(evaluateExpression('len(name)', context)).toBe(11);
    expect(evaluateExpression('contains(tags, "financials")', context)).toBe(true);
    expect(evaluateExpression('contains(tags, "legal")', context)).toBe(false);
  });

  test('throws on unknown function', () => {
    expect(() => evaluateExpression('unknown(1)', context)).toThrow();
  });

  test('throws on invalid syntax', () => {
    expect(() => evaluateExpression('1 +', context)).toThrow();
  });

  test('tokenizes expression', () => {
    const tokens = tokenize('readiness.score >= 70 && present(memo)');
    const types = tokens.filter(t => t.type !== 'EOF').map(t => t.type);
    expect(types).toEqual(['IDENT', 'GTE', 'NUMBER', 'AND', 'IDENT', 'LPAREN', 'IDENT', 'RPAREN']);
  });

  test('parser builds AST', () => {
    const tokens = tokenize('1 + 2 * 3');
    const ast = new Parser(tokens).parse();
    expect(ast.type).toBe('binary');
    expect(ast.op).toBe('+');
    expect(ast.right.op).toBe('*');
  });
});

describe('Expression Gate', () => {
  const { GateEngine } = require('../../lib/enterprise-lifecycle/gate-engine');
  const engine = new GateEngine();

  test('expression gate passes when expression is true', () => {
    const result = engine.evaluate({
      id: 'g_expr',
      type: 'expression',
      expression: 'readiness.score >= 70 && present(valuation.value)'
    }, {
      readiness: { score: 75 },
      valuation: { value: 1000000 }
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.evidence[0].result).toBe(true);
  });

  test('expression gate fails when expression is false', () => {
    const result = engine.evaluate({
      id: 'g_expr2',
      type: 'expression',
      expression: 'readiness.score >= 80'
    }, { readiness: { score: 75 } });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  test('expression gate handles missing expression', () => {
    const result = engine.evaluate({ id: 'g_expr3', type: 'expression' }, {});
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('no expression');
  });

  test('expression gate handles syntax errors gracefully', () => {
    const result = engine.evaluate({
      id: 'g_expr4',
      type: 'expression',
      expression: '1 + +'
    }, {});
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('failed');
  });
});
