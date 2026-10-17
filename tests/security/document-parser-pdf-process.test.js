const { EventEmitter } = require('events');

const mockChildren = [];

class MockChild extends EventEmitter {
  constructor(filename, options) {
    super();
    this.filename = filename;
    this.options = options;
    this.stderr = new EventEmitter();
    this.kill = jest.fn(() => true);
    this.send = jest.fn((message, callback) => {
      this.sentMessage = message;
      if (callback) callback(null);
    });
    mockChildren.push(this);
  }
}

const mockFork = jest.fn((filename, args, options) => (
  new MockChild(filename, options)
));

jest.mock('child_process', () => ({ fork: mockFork }));
jest.mock('worker_threads', () => ({
  Worker: jest.fn(() => {
    throw new Error('PDF path must not create a worker thread');
  })
}));

const {
  runPdfProcess,
  parseDocument
} = require('../../lib/api/document-parser');

describe('document parser PDF process containment', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockChildren.length = 0;
    mockFork.mockClear();
  });

  test('PDF parsing uses an isolated child process', async () => {
    const promise = parseDocument({
      buffer: Buffer.from('%PDF-1.7\nfixture\n'),
      mime: 'application/pdf',
      filename: 'fixture.pdf'
    });

    await Promise.resolve();
    expect(mockChildren).toHaveLength(1);

    const child = mockChildren[0];
    expect(child.options.serialization).toBe('advanced');
    expect(child.options.windowsHide).toBe(true);
    expect(child.options.execArgv).toEqual(expect.arrayContaining([
      '--max-old-space-size=160',
      '--max-semi-space-size=32'
    ]));
    expect(child.sentMessage.mime).toBe('application/pdf');

    child.emit('message', {
      ok: true,
      result: {
        text: 'parsed pdf',
        rows: null,
        summary: 'parsed',
        method: 'local'
      }
    });
    child.emit('exit', 0, null);

    await expect(promise).resolves.toMatchObject({ text: 'parsed pdf' });
  });

  test('PDF timeout kills the child and fails closed', async () => {
    jest.useFakeTimers();

    const promise = runPdfProcess({
      buffer: Buffer.from('%PDF-1.7\nfixture\n'),
      mime: 'application/pdf',
      filename: 'slow.pdf'
    }, { timeoutMs: 25 });

    expect(mockChildren).toHaveLength(1);
    const child = mockChildren[0];

    jest.advanceTimersByTime(25);
    expect(child.kill).toHaveBeenCalledTimes(1);

    child.emit('exit', 1, null);
    await expect(promise).rejects.toMatchObject({ code: 'PARSER_TIMEOUT' });
  });

  test('abnormal PDF child exit is isolated as parser failure', async () => {
    const promise = runPdfProcess({
      buffer: Buffer.from('%PDF-1.7\nfixture\n'),
      mime: 'application/pdf',
      filename: 'crash.pdf'
    });

    const child = mockChildren[0];
    child.emit('exit', 3221225477, null);

    await expect(promise).rejects.toMatchObject({ code: 'PARSER_FAILED' });
  });

  test('normalized parser errors cross the child boundary', async () => {
    const promise = runPdfProcess({
      buffer: Buffer.from('%PDF-1.7\nfixture\n'),
      mime: 'application/pdf',
      filename: 'bad.pdf'
    });

    const child = mockChildren[0];
    child.emit('message', {
      ok: false,
      code: 'MALFORMED_DOCUMENT',
      internalMessage: 'private parser detail'
    });
    child.emit('exit', 0, null);

    await expect(promise).rejects.toMatchObject({
      code: 'MALFORMED_DOCUMENT',
      message: 'Document could not be processed'
    });
  });
});
