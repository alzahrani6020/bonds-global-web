const { trace, OperationTrace } = require('../../lib/observability/observability');

describe('Observability', () => {
  it('traces a successful operation', async () => {
    const { result, trace: t } = await trace('test-op', async (operation) => {
      operation.step('step1', { data: 'x' });
      return { ok: true };
    });
    expect(result.ok).toBe(true);
    expect(t.name).toBe('test-op');
    expect(t.durationMs).toBeGreaterThanOrEqual(0);
    expect(t.steps).toHaveLength(1);
  });

  it('records failure', async () => {
    await expect(trace('fail-op', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
  });

  it('manually builds trace', () => {
    const op = new OperationTrace('manual');
    op.step('a');
    op.end({ value: 1 });
    const json = op.toJSON();
    expect(json.resultSummary.value).toBe(1);
  });
});
