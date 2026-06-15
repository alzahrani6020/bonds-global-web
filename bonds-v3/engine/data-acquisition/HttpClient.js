/**
 * HttpClient — موحد لطلبات HTTP الخارجية مع retry و timeout و cache و concurrency control.
 * لا يحتاج إلى مكتبات خارجية؛ يستخدم fetch الأصلي في Node.js.
 */
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

class HttpClient {
  constructor(options = {}) {
    this.retries = options.retries ?? (parseInt(process.env.HTTP_CLIENT_MAX_RETRIES, 10) || 3);
    this.timeout = options.timeout ?? (parseInt(process.env.HTTP_CLIENT_TIMEOUT_MS, 10) || 15000);
    this.maxConcurrency = options.maxConcurrency ?? (parseInt(process.env.HTTP_CLIENT_MAX_CONCURRENCY, 10) || 3);
    this.defaultHeaders = {
      'Accept': 'application/json',
      'User-Agent': options.userAgent || 'BondsV3-DataBot/1.0',
      ...options.headers
    };
    this.proxy = options.proxy || process.env.HTTP_PROXY || null;
    this.cache = options.cache || null;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000; // 24h
    this._active = 0;
    this._queue = [];
  }

  async request(url, options = {}) {
    await this._acquire();
    try {
      return await this._execute(url, options);
    } finally {
      this._release();
    }
  }

  async _execute(url, options = {}) {
    const method = options.method || 'GET';
    const headers = { ...this.defaultHeaders, ...(options.headers || {}) };
    const body = options.body || null;
    const cacheKey = options.cacheKey || (options.cache !== false ? this._cacheKey(method, url, body) : null);
    const cacheTtl = options.cacheTtlMs ?? this.cacheTtlMs;

    if (cacheKey && this.cache) {
      try {
        const cached = await this.cache.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
      } catch (err) {
        console.warn('[HttpClient] Cache read failed:', err.message);
      }
    }

    let lastErr;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      let controller;
      let timer;
      try {
        controller = new AbortController();
        timer = setTimeout(() => controller.abort(), this.timeout);

        const fetchOptions = {
          method,
          headers,
          signal: controller.signal
        };
        if (body) fetchOptions.body = body;

        const res = await fetch(url, fetchOptions);
        clearTimeout(timer);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const data = isJson
          ? await res.json().catch(() => null)
          : await res.text().catch(() => null);

        if (cacheKey && this.cache) {
          try {
            await this.cache.set(cacheKey, data, cacheTtl);
          } catch (err) {
            console.warn('[HttpClient] Cache write failed:', err.message);
          }
        }

        return data;
      } catch (err) {
        if (timer) clearTimeout(timer);
        lastErr = err;

        // Some endpoints (e.g. Geoapify) reset the TLS connection intermittently
        // on Node's global fetch over IPv6. Fall back to the native HTTP module
        // with IPv4 preference.
        if (this._shouldTryNative(err, method)) {
          try {
            const data = await this._nativeRequest(url, { method, headers, body });
            if (cacheKey && this.cache) {
              try {
                await this.cache.set(cacheKey, data, cacheTtl);
              } catch (cacheErr) {
                console.warn('[HttpClient] Cache write failed:', cacheErr.message);
              }
            }
            return data;
          } catch (nativeErr) {
            // Keep the original fetch error for reporting.
          }
        }

        const isRetryable = this._isRetryable(err, attempt);
        if (!isRetryable) break;

        const baseDelay = Math.min(1000 * 2 ** attempt, 8000);
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;
        console.warn(`[HttpClient] Attempt ${attempt + 1}/${this.retries} failed for ${url}: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastErr;
  }

  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url, body, options = {}) {
    return this.request(url, { ...options, method: 'POST', body });
  }

  _isRetryable(err, attempt) {
    if (attempt >= this.retries - 1) return false;
    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
      return true;
    }
    const msg = err.message || '';
    if (msg.includes('HTTP 429') || msg.includes('HTTP 502') || msg.includes('HTTP 503') || msg.includes('HTTP 504')) {
      return true;
    }
    return false;
  }

  _shouldTryNative(err, method) {
    if (method !== 'GET' && method !== 'POST') return false;
    const code = err.code || err.cause?.code || '';
    const msg = err.message || '';
    return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || msg === 'fetch failed';
  }

  _nativeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const reqOptions = {
        method: options.method || 'GET',
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers: options.headers || this.defaultHeaders,
        family: 4 // Prefer IPv4 to avoid intermittent TLS resets on dual-stack.
      };

      const req = transport.request(reqOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const isJson = (res.headers['content-type'] || '').includes('application/json');
            if (isJson && data) {
              try {
                resolve(JSON.parse(data));
              } catch (parseErr) {
                resolve(data);
              }
            } else {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.timeout, () => {
        req.destroy(new Error('ETIMEDOUT'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  _cacheKey(method, url, body) {
    const payload = `${method}:${url}:${JSON.stringify(body || '')}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // Simple semaphore
  _acquire() {
    if (this._active < this.maxConcurrency) {
      this._active++;
      return Promise.resolve();
    }
    return new Promise(resolve => this._queue.push(resolve));
  }

  _release() {
    this._active--;
    if (this._queue.length > 0 && this._active < this.maxConcurrency) {
      this._active++;
      const next = this._queue.shift();
      next();
    }
  }
}

/**
 * ينشئ كائن cache يستخدم جدول http_cache في Supabase.
 * @param {Object} supabase — عميل Supabase
 * @param {number} defaultTtlMs
 * @returns {{get: Function, set: Function}}
 */
function createSupabaseCache(supabase, defaultTtlMs = 24 * 60 * 60 * 1000) {
  return {
    async get(key) {
      const { data, error } = await supabase
        .from('http_cache')
        .select('value')
        .eq('key', key)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      return data?.value ?? null;
    },
    async set(key, value, ttlMs = defaultTtlMs) {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const { error } = await supabase
        .from('http_cache')
        .upsert({ key, value, expires_at: expiresAt }, { onConflict: 'key' });
      if (error) throw error;
    }
  };
}

module.exports = { HttpClient, createSupabaseCache };
