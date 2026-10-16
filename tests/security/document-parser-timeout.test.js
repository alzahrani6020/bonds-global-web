const { EventEmitter } = require('events');

const mockWorkers = [];

class MockWorker extends EventEmitter {
  constructor(filename, options) {
    super();
    this.filename = filename;
    this.options = options;
    this.terminate = jest.fn().mockResolvedValue(1);
    mockWorkers.push(this);
  }
}

jest.mock('worker_threads', () => ({ Worker: MockWorker }));

const {
  runParserWorker,
  parseDocument,
  MAX_CONCURRENCY
} = require('../../lib/api/document-parser');

describe('document parser worker timeout and concurrency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockWorkers.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('hard timeout terminates worker and late parser completion is ignored', async () => {
    const promise = runParserWorker({
      buffer: Buffer.from('%PDF-1.7\n'),
      mime: 'application/pdf',
      filename: 'slow.pdf'
    }, { timeoutMs: 25 });

    expect(mockWorkers).toHaveLength(1);
    const worker = mockWorkers[0];

    jest.advanceTimersByTime(25);
    await expect(promise).rejects.toMatchObject({ code: 'PARSER_TIMEOUT' });
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    worker.emit('message', {
      ok: true,
      result: { text: 'late result', rows: null, summary: 'late', method: 'local' }
    });

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  test('at most MAX_CONCURRENCY workers start before a slot is released', async () => {
    const input = index => ({
      buffer: Buffer.from(`row-${index}\n`),
      mime: 'text/csv',
      filename: `f-${index}.csv`
    });

    const first = parseDocument(input(1), { timeoutMs: 5_000 });
    const second = parseDocument(input(2), { timeoutMs: 5_000 });
    const third = parseDocument(input(3), { timeoutMs: 5_000 });

    await Promise.resolve();
    expect(MAX_CONCURRENCY).toBe(2);
    expect(mockWorkers).toHaveLength(2);

    mockWorkers[0].emit('message', {
      ok: true,
      result: { text: '1', rows: [['1']], summary: '1', method: 'local' }
    });

    await first;
    await Promise.resolve();
    expect(mockWorkers).toHaveLength(3);

    mockWorkers[1].emit('message', {
      ok: true,
      result: { text: '2', rows: [['2']], summary: '2', method: 'local' }
    });
    mockWorkers[2].emit('message', {
      ok: true,
      result: { text: '3', rows: [['3']], summary: '3', method: 'local' }
    });

    await expect(second).resolves.toMatchObject({ text: '2' });
    await expect(third).resolves.toMatchObject({ text: '3' });
  });

  test('worker receives explicit memory resource limits', () => {
    const promise = runParserWorker({
      buffer: Buffer.from('a,b\n1,2\n'),
      mime: 'text/csv',
      filename: 'limits.csv'
    }, { timeoutMs: 5_000 });

    expect(mockWorkers).toHaveLength(1);
    expect(mockWorkers[0].options.resourceLimits).toMatchObject({
      maxOldGenerationSizeMb: 128,
      maxYoungGenerationSizeMb: 32,
      stackSizeMb: 4
    });

    mockWorkers[0].emit('message', {
      ok: true,
      result: { text: 'ok', rows: [], summary: 'ok', method: 'local' }
    });

    return expect(promise).resolves.toMatchObject({ text: 'ok' });
  });
});
