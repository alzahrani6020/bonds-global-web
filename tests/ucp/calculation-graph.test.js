const { CalculationGraph } = require('../../lib/ucp/calculation-graph');

describe('UCP Calculation Graph', () => {
  test('builds graph and computes topological order', () => {
    const graph = CalculationGraph.build({
      inputs: { revenue: 1000, cogs: 400 },
      formulas: [
        { code: 'gross_profit', expression: 'revenue - cogs' },
        { code: 'gross_margin', expression: '(gross_profit / revenue) * 100' }
      ],
      outputs: [
        { code: 'gross_profit', formula_codes: ['gross_profit'] },
        { code: 'gross_margin', formula_codes: ['gross_margin'] }
      ]
    });
    const order = graph.topologicalOrder();
    expect(order.indexOf('input:revenue')).toBeLessThan(order.indexOf('formula:gross_profit'));
    expect(order.indexOf('formula:gross_profit')).toBeLessThan(order.indexOf('formula:gross_margin'));
  });

  test('executes graph and produces outputs', async () => {
    const graph = CalculationGraph.build({
      inputs: { revenue: 1000, cogs: 400 },
      formulas: [
        { code: 'gross_profit', expression: 'revenue - cogs' }
      ],
      outputs: [
        { code: 'gross_profit', formula_codes: ['gross_profit'] }
      ]
    });
    const { context } = await graph.execute((node, ctx) => {
      if (node.type === 'input') return node.value;
      if (node.type === 'formula') {
        const { evaluateExpression } = require('../../lib/ucp/expression-evaluator');
        return evaluateExpression(node.expression, ctx);
      }
      if (node.type === 'output') return ctx[node.inputs[0]];
    });
    expect(context.gross_profit).toBe(600);
  });

  test('detects circular dependency', () => {
    const graph = CalculationGraph.build({
      inputs: {},
      formulas: [
        { code: 'a', expression: 'b + 1' },
        { code: 'b', expression: 'a + 1' }
      ],
      outputs: []
    });
    expect(() => graph.topologicalOrder()).toThrow('Circular dependency');
  });

  test('returns parallel execution levels', () => {
    const graph = CalculationGraph.build({
      inputs: { a: 1, b: 2, c: 3 },
      formulas: [
        { code: 'x', expression: 'a + b' },
        { code: 'y', expression: 'b + c' },
        { code: 'z', expression: 'x + y' }
      ],
      outputs: []
    });
    const levels = graph.parallelLevels();
    expect(levels[0]).toContain('input:a');
    expect(levels[1]).toContain('formula:x');
    expect(levels[1]).toContain('formula:y');
    expect(levels[2]).toContain('formula:z');
  });

  test('impact analysis returns downstream nodes', () => {
    const graph = CalculationGraph.build({
      inputs: { revenue: 1000, cogs: 400 },
      formulas: [
        { code: 'gross_profit', expression: 'revenue - cogs' },
        { code: 'gross_margin', expression: '(gross_profit / revenue) * 100' }
      ],
      outputs: [{ code: 'gross_margin', formula_codes: ['gross_margin'] }]
    });
    const impacted = graph.impactedNodes('revenue');
    const codes = impacted.map(n => n.code);
    expect(codes).toContain('gross_profit');
    expect(codes).toContain('gross_margin');
  });
});
