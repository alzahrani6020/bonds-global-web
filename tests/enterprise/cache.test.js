/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

class LocalStorageMock {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}

const code = fs.readFileSync(path.join(__dirname, '../../lib/enterprise/cache.js'), 'utf8');

describe('BondsCache', () => {
  let C;

  beforeEach(() => {
    global.localStorage = new LocalStorageMock();
    const ctx = {};
    const fn = new Function('window', code);
    fn(ctx);
    C = ctx.BondsCache;
    C.clear();
  });

  afterEach(() => {
    delete global.localStorage;
  });

  test('stores and retrieves value', () => {
    C.set('key', { a: 1 });
    expect(C.get('key')).toEqual({ a: 1 });
  });

  test('returns null for missing key', () => {
    expect(C.get('missing')).toBeNull();
  });

  test('expires after TTL', (done) => {
    C.set('key', 'value', 10);
    setTimeout(() => {
      expect(C.get('key')).toBeNull();
      done();
    }, 20);
  });

  test('wrap caches fetcher result', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return 'data'; };
    const v1 = await C.wrap(fetcher, 'wrapkey');
    const v2 = await C.wrap(fetcher, 'wrapkey');
    expect(v1).toBe('data');
    expect(v2).toBe('data');
    expect(calls).toBe(1);
  });
});
