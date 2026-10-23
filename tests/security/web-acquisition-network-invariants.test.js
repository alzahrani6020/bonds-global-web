const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

function makeResponse(statusCode, headers = {}, chunks = [], options = {}) {
  const stream = new PassThrough();
  stream.statusCode = statusCode;
  stream.headers = headers;
  const delayMs = options.delayMs || 0;
  const intervalMs = options.intervalMs || 0;

  process.nextTick(() => {
    if (intervalMs > 0) {
      let index = 0;
      const timer = setInterval(() => {
        if (stream.destroyed) {
          clearInterval(timer);
          return;
        }
        if (index >= chunks.length) {
          clearInterval(timer);
          stream.end();
          return;
        }
        stream.write(chunks[index++]);
      }, intervalMs);
      stream.once('close', () => clearInterval(timer));
      stream.once('error', () => clearInterval(timer));
      return;
    }

    setTimeout(() => {
      if (stream.destroyed) return;
      for (const chunk of chunks) stream.write(chunk);
      stream.end();
    }, delayMs);
  });

  return stream;
}

function loadAcquisition({ dnsLookup, onRequest }) {
  jest.resetModules();

  const lookup = jest.fn(dnsLookup);
  const request = jest.fn((options, callback) => {
    const req = new EventEmitter();
    req.destroyed = false;

    req.end = () => {
      options.lookup(options.hostname, {}, (error, address, family) => {
        if (error) {
          req.emit('error', error);
          return;
        }
        onRequest({ options, callback, req, address, family });
      });
    };

    req.destroy = error => {
      if (req.destroyed) return;
      req.destroyed = true;
      if (error) req.emit('error', error);
    };

    return req;
  });

  jest.doMock('dns', () => ({ promises: { lookup } }));
  jest.doMock('http', () => ({ request }));
  jest.doMock('https', () => ({ request }));

  const acquisition = require('../../lib/intelligence/web-acquisition');
  return { acquisition, lookup, request };
}

describe('web acquisition network invariants', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('dns');
    jest.dontMock('http');
    jest.dontMock('https');
  });

  test('pins the validated DNS address set to the outbound connection with no second resolver lookup', async () => {
    const validatedAddress = '93.184.216.34';
    const connectAddresses = [];

    const { acquisition, lookup, request } = loadAcquisition({
      dnsLookup: async () => [{ address: validatedAddress, family: 4 }],
      onRequest: ({ callback, address }) => {
        connectAddresses.push(address);
        callback(makeResponse(200, { 'content-type': 'text/plain' }, ['ok']));
      }
    });

    const result = await acquisition.fetchUrl('http://public.example/resource', {
      timeoutMs: 200,
      maxBytes: 32
    });

    expect(result.ok).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('public.example', { all: true, verbatim: true });
    expect(request).toHaveBeenCalledTimes(1);
    const requestOptions = request.mock.calls[0][0];
    expect(requestOptions.family).toBe(4);
    expect(requestOptions.autoSelectFamily).toBe(false);
    expect(connectAddresses).toEqual([validatedAddress]);
  });

  test.each([
    ['IPv4 loopback', 'http://127.0.0.1/internal', '127.0.0.1', 4],
    ['IPv6 loopback', 'http://[::1]/internal', '::1', 6]
  ])('revalidates redirects and blocks %s before a second connect', async (_label, redirectUrl, privateAddress, family) => {
    let requestCount = 0;
    const { acquisition, request } = loadAcquisition({
      dnsLookup: async hostname => {
        const normalized = String(hostname).replace(/^\[|\]$/g, '');
        if (normalized === 'public.example') return [{ address: '93.184.216.34', family: 4 }];
        if (normalized === privateAddress) return [{ address: privateAddress, family }];
        throw new Error('unexpected hostname: ' + hostname);
      },
      onRequest: ({ callback }) => {
        requestCount += 1;
        callback(makeResponse(302, { location: redirectUrl }, []));
      }
    });

    const result = await acquisition.fetchUrl('http://public.example/start', {
      timeoutMs: 200,
      maxRedirects: 5
    });

    expect(result.ok).toBe(false);
    expect(result.evidence.failure_class).toBe('REDIRECT_BLOCKED');
    expect(result.evidence.blocked_reason).toBe('PRIVATE_OR_RESERVED_DESTINATION');
    expect(requestCount).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('enforces an absolute deadline against a slow-drip body', async () => {
    const { acquisition } = loadAcquisition({
      dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
      onRequest: ({ callback }) => {
        callback(makeResponse(
          200,
          { 'content-type': 'text/plain' },
          Array.from({ length: 100 }, () => Buffer.from('x')),
          { intervalMs: 5 }
        ));
      }
    });

    const started = Date.now();
    const result = await acquisition.fetchUrl('http://public.example/slow', {
      timeoutMs: 35,
      maxBytes: 1024
    });
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(false);
    expect(result.evidence.failure_class).toBe('TIMEOUT');
    expect(elapsed).toBeLessThan(250);
  });

  test('enforces maxBytes, returns no more than the limit, and disposes the truncated stream', async () => {
    let response;
    const { acquisition } = loadAcquisition({
      dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
      onRequest: ({ callback }) => {
        response = makeResponse(200, { 'content-type': 'application/octet-stream' }, [
          Buffer.alloc(64, 0x61)
        ]);
        callback(response);
      }
    });

    const result = await acquisition.fetchUrl('http://public.example/large', {
      timeoutMs: 200,
      maxBytes: 8
    });

    expect(result.body.length).toBe(8);
    expect(result.evidence.content_length).toBe(8);
    expect(result.evidence.failure_class).toBe('BODY_TRUNCATED');
    expect(response.destroyed).toBe(true);
  });
});
